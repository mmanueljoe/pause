// Runs every minute (pg_cron, see migrations/20261124090000_alerts.sql).
// 1. Reads new Pause transactions from Solana and records what happened:
//    withdrawals (with their alert level and reasons), stops, payouts, and
//    less-safe setting changes.
// 2. Releases withdrawals whose wait has ended (US-9, FR-12).
// 3. Sends the emails that are due: alerts (FR-16, FR-17, US-12, US-13) and
//    arrivals (FR-9, US-6).
// If this is late or down, no money moves early: Solana still makes every
// withdrawal wait, and the guardian can still stop it in the app.
import {
  arrivalEmail,
  urgentReasons,
  guardianChangeEmail,
  guardianWithdrawalEmail,
  ownerChangeEmail,
  ownerWithdrawalEmail,
  type UrgentReason,
} from "../_shared/alerts.ts";
import { serviceClient } from "../_shared/db.ts";
import { type Email, sendEmail } from "../_shared/email.ts";
import {
  type ChangeKind,
  eventsInTransaction,
  type PauseEvent,
  type RpcTransaction,
} from "../_shared/events.ts";
import { fail, json } from "../_shared/http.ts";
import { PAUSE_PROGRAM_ADDRESS, readVault, rpc } from "../_shared/solana.ts";
import {
  releaseMessage,
  type Signer,
  signerFromSeed,
  signTransaction,
} from "../_shared/transaction.ts";

/** Transactions read per run, so a long backlog never times out. */
const MAX_TRANSACTIONS_PER_RUN = 100;
/** Only email about things this recent: no flood of old alerts on first run. */
const EMAIL_WINDOW_MS = 15 * 60_000;
/** Releases tried per run. */
const MAX_RELEASES_PER_RUN = 10;

type Db = ReturnType<typeof serviceClient>;

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const db = serviceClient();
    // Only the scheduler knows this secret (generated inside the database).
    const { data: allowed, error: secretError } = await db.rpc(
      "check_cron_secret",
      { candidate: req.headers.get("x-cron-secret") ?? "" }
    );
    if (secretError) throw secretError;
    if (allowed !== true) return fail("Not allowed.", 401);
    const read = await readNewTransactions(db);
    const releaser = await releaserSigner(db);
    const released = await releaseDue(db, releaser);
    const sent = await sendDueEmails(db);
    return json({ read, released, sent, releaser: releaser.address });
  } catch (error) {
    console.error(error);
    return fail("Sync failed.", 500);
  }
});

// ---------- 1. Read Solana ----------

type SignatureInfo = {
  signature: string;
  err: unknown;
  blockTime: number | null;
};

async function readNewTransactions(db: Db): Promise<number> {
  const { data: state, error } = await db
    .from("sync_state")
    .select("last_signature")
    .eq("id", 1)
    .single();
  if (error) throw error;
  const until: string | undefined = state.last_signature ?? undefined;

  // Newest first, back to where we stopped last time (or the very start).
  const newestFirst: SignatureInfo[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await rpc<SignatureInfo[]>("getSignaturesForAddress", [
      PAUSE_PROGRAM_ADDRESS,
      { limit: 1000, before, until, commitment: "confirmed" },
    ]);
    newestFirst.push(...page);
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
  }

  const batch = newestFirst.reverse().slice(0, MAX_TRANSACTIONS_PER_RUN);
  let read = 0;
  for (const info of batch) {
    if (!info.err) {
      const tx = await rpc<RpcTransaction | null>("getTransaction", [
        info.signature,
        {
          encoding: "json",
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        },
      ]);
      if (!tx) break; // not available yet: try again next run, in order
      const at = new Date(
        (tx.blockTime ?? info.blockTime ?? Date.now() / 1000) * 1000
      );
      for (const event of eventsInTransaction(tx, PAUSE_PROGRAM_ADDRESS)) {
        await recordEvent(db, event, info.signature, at);
      }
    }
    // Move the bookmark after each transaction, so nothing is read twice.
    const { error: saveError } = await db
      .from("sync_state")
      .update({
        last_signature: info.signature,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (saveError) throw saveError;
    read++;
  }
  return read;
}

/** Saves what an event means. Safe to run twice for the same event. */
async function recordEvent(
  db: Db,
  event: PauseEvent,
  signature: string,
  at: Date
) {
  switch (event.name) {
    case "WithdrawalRequested":
      return recordRequest(db, event, signature, at);
    case "WithdrawalStopped":
      return setWithdrawalStatus(db, event.withdrawal, "stopped");
    case "WithdrawalApproved":
    case "WithdrawalReleased": {
      await setWithdrawalStatus(
        db,
        event.withdrawal,
        event.name === "WithdrawalApproved" ? "approved_early" : "released"
      );
      const { error: arrivedError } = await db
        .from("withdrawal_alerts")
        .update({ arrived_at: at.toISOString() })
        .eq("withdrawal", event.withdrawal)
        .is("arrived_at", null);
      if (arrivedError) throw arrivedError;
      // Only a payment that actually went out makes an address familiar.
      const { error } = await db.from("paid_addresses").upsert(
        {
          vault: event.vault,
          address: event.recipient,
          first_paid_at: at.toISOString(),
        },
        { onConflict: "vault,address", ignoreDuplicates: true }
      );
      if (error) throw error;
      return;
    }
    case "ChangeProposed": {
      const vault = await readVault(event.vault);
      const { error } = await db.from("change_alerts").upsert(
        {
          signature,
          vault: event.vault,
          kind: event.change,
          proposed_at: at.toISOString(),
          apply_after: new Date(event.applyAfter * 1000).toISOString(),
          guardian: vault?.guardian ?? null,
        },
        { onConflict: "signature", ignoreDuplicates: true }
      );
      if (error) throw error;
      return;
    }
    case "ChangeApplied":
    case "ChangeCancelled": {
      const { error } = await db
        .from("change_alerts")
        .update({
          status: event.name === "ChangeApplied" ? "applied" : "cancelled",
        })
        .eq("vault", event.vault)
        .eq("status", "waiting");
      if (error) throw error;
      return;
    }
  }
}

async function recordRequest(
  db: Db,
  event: Extract<PauseEvent, { name: "WithdrawalRequested" }>,
  signature: string,
  at: Date
) {
  const { data: existing } = await db
    .from("withdrawal_alerts")
    .select("withdrawal")
    .eq("withdrawal", event.withdrawal)
    .maybeSingle();
  if (existing) return;

  const [{ data: profile }, { data: paid }, { data: waiting }, vault] =
    await Promise.all([
      db
        .from("vault_profiles")
        .select("owner_time_zone")
        .eq("vault", event.vault)
        .maybeSingle(),
      db
        .from("paid_addresses")
        .select("address")
        .eq("vault", event.vault)
        .eq("address", event.recipient)
        .maybeSingle(),
      db
        .from("withdrawal_alerts")
        .select("amount_lamports")
        .eq("vault", event.vault)
        .eq("status", "waiting"),
      readVault(event.vault),
    ]);

  // The vault's balance now: all its SOL minus the rent minimum.
  let balance = 0n;
  if (vault) {
    const rent = await rpc<number>("getMinimumBalanceForRentExemption", [
      vault.space,
    ]);
    balance = BigInt(Math.max(0, vault.lamports - rent));
  }
  const reasons = urgentReasons({
    paidBefore: Boolean(paid),
    amountLamports: event.amountLamports,
    otherWaitingLamports: (waiting ?? []).map((w) => BigInt(w.amount_lamports)),
    balanceLamports: balance,
    requestedAt: at,
    timeZone: profile?.owner_time_zone ?? null,
  });

  const { error } = await db.from("withdrawal_alerts").upsert(
    {
      withdrawal: event.withdrawal,
      vault: event.vault,
      withdrawal_id: event.id.toString(),
      recipient: event.recipient,
      amount_lamports: event.amountLamports.toString(),
      requested_at: at.toISOString(),
      release_at: new Date(event.releaseAt * 1000).toISOString(),
      level: reasons.length ? "urgent" : "quiet",
      reasons,
      guardian: vault?.guardian ?? null,
      request_signature: signature,
    },
    { onConflict: "withdrawal", ignoreDuplicates: true }
  );
  if (error) throw error;
}

async function setWithdrawalStatus(db: Db, withdrawal: string, status: string) {
  const { error } = await db
    .from("withdrawal_alerts")
    .update({ status })
    .eq("withdrawal", withdrawal)
    .eq("status", "waiting");
  if (error) throw error;
}

// ---------- 2. Release ----------

/** The backend's fee-paying wallet; its seed never leaves Supabase Vault. */
async function releaserSigner(db: Db): Promise<Signer> {
  const { data: seedHex, error } = await db.rpc("get_releaser_seed");
  if (error) throw error;
  if (typeof seedHex !== "string" || !/^[0-9a-f]{64}$/.test(seedHex))
    throw new Error("Releaser seed is missing from Vault.");
  const seed = Uint8Array.from(seedHex.match(/../g)!, (h) => parseInt(h, 16));
  return signerFromSeed(seed);
}

/**
 * Sends every withdrawal whose wait has ended to its named recipient. The
 * program checks the wait and the recipient, so a mistake here can't move
 * money early or elsewhere; it would just fail. Success shows up as a
 * WithdrawalReleased event on the next run.
 */
async function releaseDue(db: Db, releaser: Signer): Promise<number> {
  const now = Date.now();
  const { data: due, error } = await db
    .from("withdrawal_alerts")
    .select("withdrawal, vault, recipient")
    .eq("status", "waiting")
    .lte("release_at", new Date(now).toISOString())
    .gte("release_at", new Date(now - 7 * 86_400_000).toISOString())
    .order("release_at")
    .limit(MAX_RELEASES_PER_RUN);
  if (error) throw error;
  if (!due?.length) return 0;

  const { value: latest } = await rpc<{ value: { blockhash: string } }>(
    "getLatestBlockhash",
    [{ commitment: "confirmed" }]
  );
  let sent = 0;
  for (const row of due) {
    try {
      const wire = await signTransaction(
        releaseMessage({
          payer: releaser.address,
          vault: row.vault,
          withdrawal: row.withdrawal,
          recipient: row.recipient,
          recentBlockhash: latest.blockhash,
        }),
        releaser
      );
      await rpc<string>("sendTransaction", [
        wire,
        { encoding: "base64", preflightCommitment: "confirmed" },
      ]);
      sent++;
    } catch (error) {
      // E.g. already stopped on Solana, the network clock is a few seconds
      // behind, or the releaser wallet needs devnet SOL. Next run retries.
      console.error(`Couldn't release ${row.withdrawal}:`, error);
    }
  }
  return sent;
}

// ---------- 3. Send emails ----------

type Profile = {
  owner: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_time_zone: string | null;
};

async function sendDueEmails(db: Db): Promise<number> {
  const since = new Date(Date.now() - EMAIL_WINDOW_MS).toISOString();
  const profiles = new Map<string, Profile | null>();
  const profileOf = async (vault: string) => {
    if (!profiles.has(vault)) {
      const { data } = await db
        .from("vault_profiles")
        .select("owner, owner_name, owner_email, owner_time_zone")
        .eq("vault", vault)
        .maybeSingle();
      profiles.set(vault, data);
    }
    return profiles.get(vault) ?? null;
  };
  const guardianEmail = async (vault: string, guardian: string | null) => {
    if (!guardian) return null;
    const { data } = await db
      .from("guardian_contacts")
      .select("email")
      .eq("vault", vault)
      .eq("guardian", guardian)
      .maybeSingle();
    return data?.email ?? null;
  };
  let sent = 0;

  const { data: withdrawals, error } = await db
    .from("withdrawal_alerts")
    .select("*")
    .eq("status", "waiting")
    .gte("requested_at", since)
    .or("guardian_alerted_at.is.null,owner_alerted_at.is.null");
  if (error) throw error;
  for (const row of withdrawals ?? []) {
    const profile = await profileOf(row.vault);
    const alert = {
      vault: row.vault,
      id: BigInt(row.withdrawal_id),
      recipient: row.recipient,
      amountLamports: BigInt(row.amount_lamports),
      releaseAt: new Date(row.release_at),
      reasons: row.reasons as UrgentReason[],
      ownerName: profile?.owner_name ?? null,
      timeZone: profile?.owner_time_zone ?? null,
    };
    const key = {
      table: "withdrawal_alerts",
      column: "withdrawal",
      value: row.withdrawal,
    };
    if (!row.guardian_alerted_at) {
      const to = await guardianEmail(row.vault, row.guardian);
      if (
        to &&
        (await sendOnce(
          db,
          key,
          "guardian_alerted_at",
          guardianWithdrawalEmail(to, alert)
        ))
      )
        sent++;
    }
    if (!row.owner_alerted_at && profile?.owner_email) {
      if (
        await sendOnce(
          db,
          key,
          "owner_alerted_at",
          ownerWithdrawalEmail(profile.owner_email, alert)
        )
      )
        sent++;
    }
  }

  const { data: changes, error: changeError } = await db
    .from("change_alerts")
    .select("*")
    .eq("status", "waiting")
    .gte("proposed_at", since)
    .or("guardian_alerted_at.is.null,owner_alerted_at.is.null");
  if (changeError) throw changeError;
  for (const row of changes ?? []) {
    const profile = await profileOf(row.vault);
    const alert = {
      change: row.kind as ChangeKind,
      applyAfter: new Date(row.apply_after),
      ownerName: profile?.owner_name ?? null,
      timeZone: profile?.owner_time_zone ?? null,
    };
    const key = {
      table: "change_alerts",
      column: "signature",
      value: row.signature,
    };
    if (!row.guardian_alerted_at) {
      const to = await guardianEmail(row.vault, row.guardian);
      if (
        to &&
        (await sendOnce(
          db,
          key,
          "guardian_alerted_at",
          guardianChangeEmail(to, alert)
        ))
      )
        sent++;
    }
    if (!row.owner_alerted_at && profile?.owner_email) {
      if (
        await sendOnce(
          db,
          key,
          "owner_alerted_at",
          ownerChangeEmail(profile.owner_email, alert)
        )
      )
        sent++;
    }
  }
  const { data: arrivals, error: arrivalError } = await db
    .from("withdrawal_alerts")
    .select("withdrawal, vault, recipient, amount_lamports, status")
    .in("status", ["released", "approved_early"])
    .gte("arrived_at", since)
    .is("arrival_emailed_at", null);
  if (arrivalError) throw arrivalError;
  for (const row of arrivals ?? []) {
    const profile = await profileOf(row.vault);
    if (!profile?.owner_email) continue;
    const email = arrivalEmail(profile.owner_email, {
      amountLamports: BigInt(row.amount_lamports),
      recipient: row.recipient,
      ownerWallet: profile.owner,
      early: row.status === "approved_early",
    });
    const key = {
      table: "withdrawal_alerts",
      column: "withdrawal",
      value: row.withdrawal,
    };
    if (await sendOnce(db, key, "arrival_emailed_at", email)) sent++;
  }
  return sent;
}

/**
 * Marks the email as sent first (only if nobody else did), then sends. If
 * sending fails, un-marks it so the next run retries. Two overlapping runs
 * can never both send the same email.
 */
async function sendOnce(
  db: Db,
  key: { table: string; column: string; value: string },
  sentColumn: string,
  email: Email
): Promise<boolean> {
  const { data: claimed, error } = await db
    .from(key.table)
    .update({ [sentColumn]: new Date().toISOString() })
    .eq(key.column, key.value)
    .is(sentColumn, null)
    .select(key.column);
  if (error) throw error;
  if (!claimed?.length) return false;
  if (await sendEmail(email)) return true;
  await db
    .from(key.table)
    .update({ [sentColumn]: null })
    .eq(key.column, key.value);
  return false;
}
