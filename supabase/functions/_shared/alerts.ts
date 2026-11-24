/**
 * How loudly to alert (docs/requirements.md, "Alert levels") and what the
 * alert emails say (FR-16, FR-17, FR-17a). Pure: no Deno APIs or database,
 * so it can be tested with Node.
 */
import type { Email } from "./email.ts";
import type { ChangeKind } from "./events.ts";

/** Same shape the website uses (src/lib/pause/withdrawals.ts), plus night. */
export type UrgentReason =
  | { kind: "new-address" }
  | { kind: "share"; percent: number }
  | { kind: "another-waiting" }
  | { kind: "night" };

/** 11 pm to 6 am in the owner's time zone. */
export function isNight(at: Date, timeZone: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(at)
  );
  return hour >= 23 || hour < 6;
}

/**
 * Why a new withdrawal looks like theft. Empty means quiet. Sending to the
 * owner's own wallet is no exception: a thief controls that wallet too.
 */
export function urgentReasons(input: {
  /** The vault has paid this recipient before (released or approved). */
  paidBefore: boolean;
  amountLamports: bigint;
  /** Amounts of the vault's other withdrawals that are still waiting. */
  otherWaitingLamports: bigint[];
  /** The vault's balance (SOL above the rent minimum). */
  balanceLamports: bigint;
  requestedAt: Date;
  /** The owner's time zone, if they gave one. */
  timeZone: string | null;
}): UrgentReason[] {
  const reasons: UrgentReason[] = [];
  if (!input.paidBefore) reasons.push({ kind: "new-address" });

  const waitingTotal = input.otherWaitingLamports.reduce(
    (sum, a) => sum + a,
    input.amountLamports
  );
  if (input.balanceLamports > 0n) {
    const percent = Number((waitingTotal * 100n) / input.balanceLamports);
    if (percent >= 25) reasons.push({ kind: "share", percent });
  }
  if (input.otherWaitingLamports.length > 0)
    reasons.push({ kind: "another-waiting" });
  if (input.timeZone && isNight(input.requestedAt, input.timeZone))
    reasons.push({ kind: "night" });
  return reasons;
}

// ---------- Formatting ----------

/** 2500000000n -> "2.5" */
export function formatSol(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = (lamports % 1_000_000_000n)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** "8DbH…otpY" */
export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** "Africa/Accra" -> "Accra time" */
export function zoneLabel(timeZone: string): string {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  const city = timeZone.split("/").pop() ?? timeZone;
  return `${city.replaceAll("_", " ")} time`;
}

/**
 * A fixed time, never a countdown (FR-17a): "Sun 24 Nov at 9:14 pm, Accra time".
 * Without a time zone, UTC.
 */
export function formatTime(at: Date, timeZone: string | null): string {
  const zone = timeZone ?? "UTC";
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, ...options }).format(at);
  const day = part({ weekday: "short", day: "numeric", month: "short" });
  const time = part({ hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s+/g, " ")
    .toLowerCase();
  return `${day.replace(",", "")} at ${time}, ${zoneLabel(zone)}`;
}

/** 90000 -> "1 day 1 hour" */
export function formatWait(secs: number): string {
  const units: [number, string][] = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];
  const parts: string[] = [];
  let left = secs;
  for (const [size, name] of units) {
    const n = Math.floor(left / size);
    if (n > 0) parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
    left -= n * size;
  }
  if (parts.length === 0) return `${secs} seconds`;
  return parts.slice(0, 2).join(" ");
}

// ---------- Withdrawal emails ----------

export type WithdrawalAlert = {
  vault: string;
  id: bigint;
  recipient: string;
  amountLamports: bigint;
  releaseAt: Date;
  reasons: UrgentReason[];
  ownerName: string | null;
  timeZone: string | null;
};

function paymentPath(a: { vault: string; id: bigint }): string {
  return `/vaults/${a.vault}/payments/${a.id}`;
}

function reasonText(reason: UrgentReason, owner: boolean): string {
  const vault = owner ? "your vault" : "the vault";
  switch (reason.kind) {
    case "new-address":
      return `It's going to an address ${vault} has never paid.`;
    case "share":
      return `It's ${reason.percent}% of ${vault}, counting withdrawals already waiting.`;
    case "another-waiting":
      return "Another withdrawal is already waiting.";
    case "night":
      return owner
        ? "It was asked for between 11 pm and 6 am, your time."
        : "It was asked for between 11 pm and 6 am, the owner's time.";
  }
}

const RESCUE_PATH = "/vault/withdraw?rescue=1";

/** FR-16: urgent (a quick decision) or quiet (nothing to do). */
export function guardianWithdrawalEmail(to: string, a: WithdrawalAlert): Email {
  const sol = formatSol(a.amountLamports);
  const who = a.ownerName ?? "The vault's owner";
  const leaves = formatTime(a.releaseAt, a.timeZone);
  const isNew = a.reasons.some((r) => r.kind === "new-address");
  if (a.reasons.length === 0) {
    return {
      to,
      subject: `${who} is moving ${sol} SOL to an address the vault has paid before`,
      paragraphs: [
        `${who} is moving ${sol} SOL to ${shortAddress(a.recipient)}, an address the vault has paid before. It leaves the vault ${leaves}.`,
        "Nothing to do unless this looks wrong.",
      ],
      buttons: [{ label: "View in Pause", path: paymentPath(a) }],
    };
  }
  const question = a.ownerName
    ? `Was this ${a.ownerName}?`
    : "Was this really the owner?";
  return {
    to,
    subject: `${who} is sending ${sol} SOL${isNew ? " to a new address" : ""}. ${question}`,
    paragraphs: [
      `${isNew ? "New address. " : ""}${who} is sending ${sol} SOL to ${shortAddress(a.recipient)}. It leaves the vault ${leaves}.`,
      "Why this looks urgent:",
      ...a.reasons.map((r) => `• ${reasonText(r, false)}`),
      `If ${a.ownerName ?? "the owner"} didn't ask for this, stop it now. If they did and need it sooner, you can approve it now.`,
    ],
    buttons: [
      { label: "Stop this payment", path: paymentPath(a) },
      { label: "Approve now", path: paymentPath(a) },
    ],
  };
}

/** FR-17: the owner hears about every withdrawal. Wording per FR-18. */
export function ownerWithdrawalEmail(to: string, a: WithdrawalAlert): Email {
  const sol = formatSol(a.amountLamports);
  const leaves = formatTime(a.releaseAt, a.timeZone);
  if (a.reasons.length === 0) {
    return {
      to,
      subject: `You asked to send ${sol} SOL`,
      paragraphs: [
        `You asked to send ${sol} SOL to ${shortAddress(a.recipient)}. It leaves your vault ${leaves}.`,
        "If this wasn't you, stop it in Pause.",
      ],
      buttons: [{ label: "View in Pause", path: paymentPath(a) }],
    };
  }
  return {
    to,
    subject: `Was this you? Your wallet asked to send ${sol} SOL`,
    paragraphs: [
      `Your wallet asked to send ${sol} SOL to ${shortAddress(a.recipient)}. It leaves your vault ${leaves}.`,
      "Why this looks urgent:",
      ...a.reasons.map((r) => `• ${reasonText(r, true)}`),
      "If this wasn't you, stop it now. Then move your savings to a new wallet with your guardian's help, because whoever did this still has your key.",
    ],
    buttons: [
      { label: "Stop this payment", path: paymentPath(a) },
      { label: "Rescue my savings", path: RESCUE_PATH },
    ],
  };
}

// ---------- Setting change emails (always urgent) ----------

export type ChangeAlert = {
  change: ChangeKind;
  applyAfter: Date;
  ownerName: string | null;
  timeZone: string | null;
};

/** For the current guardian: a thief with the owner's key would do this first. */
export function guardianChangeEmail(to: string, c: ChangeAlert): Email {
  const who = c.ownerName ?? "The vault's owner";
  const what =
    c.change.kind === "guardian"
      ? c.change.newGuardian
        ? `replace you as guardian with ${shortAddress(c.change.newGuardian)}`
        : "remove you as guardian"
      : `shorten the withdrawal wait to ${formatWait(c.change.newWaitSecs)}`;
  const question = c.ownerName
    ? `Was this ${c.ownerName}?`
    : "Was this really the owner?";
  return {
    to,
    subject: `${who}'s wallet asked to ${what}. ${question}`,
    paragraphs: [
      `${who}'s wallet asked to ${what}. It applies ${formatTime(c.applyAfter, c.timeZone)}.`,
      "This is the kind of change a thief with the owner's key makes first. Until it applies, you can stop it.",
    ],
    buttons: [{ label: "Stop this change", path: "/guardian" }],
  };
}

export function ownerChangeEmail(to: string, c: ChangeAlert): Email {
  const what =
    c.change.kind === "guardian"
      ? c.change.newGuardian
        ? `change your guardian to ${shortAddress(c.change.newGuardian)}`
        : "remove your guardian"
      : `shorten your withdrawal wait to ${formatWait(c.change.newWaitSecs)}`;
  return {
    to,
    subject: `Was this you? Your wallet asked to ${what}`,
    paragraphs: [
      `Your wallet asked to ${what}. It applies ${formatTime(c.applyAfter, c.timeZone)}.`,
      "If this wasn't you, cancel it now, before it applies.",
    ],
    buttons: [{ label: "Cancel this change", path: "/settings" }],
  };
}
