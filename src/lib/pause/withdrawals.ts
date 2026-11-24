import type { VaultState, WithdrawalState } from "./accounts";

/**
 * Addresses this vault has already paid (a released or approved withdrawal).
 * Anything else is a "New address" (FR-10). A request alone never counts.
 */
export function paidAddresses(withdrawals: WithdrawalState[]): Set<string> {
  return new Set(
    withdrawals
      .filter(
        (w) =>
          w.data.status.__kind === "Released" ||
          w.data.status.__kind === "ApprovedEarly"
      )
      .map((w) => w.data.recipient)
  );
}

/** Minimum size of a withdrawal: what Solana lets a brand-new address hold. */
export const MIN_WITHDRAWAL_LAMPORTS = 890_880n;

export type UrgentReason =
  | { kind: "new-address" }
  | { kind: "share"; percent: number }
  | { kind: "another-waiting" }
  | { kind: "night" };

/** How loudly the backend alerted about one withdrawal, and why. */
export type SavedAlert = {
  level: "urgent" | "quiet";
  reasons: UrgentReason[];
};

/**
 * Why a waiting withdrawal looks like theft (docs/requirements.md, Alert
 * levels). Computed from Solana data, so it can't know the night-time rule
 * (that needs the owner's time zone). Prefer `alertReasons`, which uses what
 * the backend saved when it has it.
 */
export function urgentReasons(
  withdrawal: WithdrawalState,
  vault: VaultState,
  all: WithdrawalState[]
): UrgentReason[] {
  const reasons: UrgentReason[] = [];
  if (!paidAddresses(all).has(withdrawal.data.recipient))
    reasons.push({ kind: "new-address" });

  const waiting = all.filter((w) => w.data.status.__kind === "Waiting");
  const waitingTotal = waiting.reduce(
    (sum, w) => sum + w.data.amountLamports,
    0n
  );
  if (vault.balance > 0n) {
    // Counting every withdrawal already waiting, as a share of the vault.
    const percent = Number((waitingTotal * 100n) / vault.balance);
    if (percent >= 25) reasons.push({ kind: "share", percent });
  }
  if (waiting.some((w) => w.address !== withdrawal.address)) {
    reasons.push({ kind: "another-waiting" });
  }
  return reasons;
}

const KNOWN_REASONS = new Set([
  "new-address",
  "share",
  "another-waiting",
  "night",
]);

/**
 * The urgent reasons to show for a withdrawal. Only waiting withdrawals have
 * any. Uses the reasons the backend saved when the request arrived (keyed by
 * withdrawal id, including the night-time rule); otherwise works them out
 * from Solana data with `urgentReasons`.
 */
export function alertReasons(
  withdrawal: WithdrawalState,
  vault: VaultState,
  all: WithdrawalState[],
  saved?: Record<string, SavedAlert>
): UrgentReason[] {
  if (withdrawal.data.status.__kind !== "Waiting") return [];
  const local = urgentReasons(withdrawal, vault, all);
  const alert = saved?.[String(withdrawal.data.id)];
  if (!alert || !Array.isArray(alert.reasons)) return local;
  // Both: the backend's (incl. night) plus anything that has become true
  // since, like a second withdrawal now waiting. Louder is safer.
  const reasons = alert.reasons.filter((r) => KNOWN_REASONS.has(r?.kind));
  for (const r of local) {
    if (!reasons.some((s) => s.kind === r.kind)) reasons.push(r);
  }
  return reasons;
}

/** A possessive for the owner: "Ama's", or "the owner's" with no name. */
export function ownersName(ownerName: string | null | undefined): string {
  return ownerName ? `${ownerName}'s` : "the owner's";
}

/** One urgent reason as a short tag. The owner reads "your time". */
export function reasonLabel(
  reason: UrgentReason,
  viewer: "owner" | "guardian" | "other",
  ownerName?: string | null
): string {
  switch (reason.kind) {
    case "new-address":
      return "New address";
    case "share":
      return `${reason.percent}% of the savings`;
    case "another-waiting":
      return "Another payment is waiting";
    case "night":
      return `Asked for between 11 pm and 6 am, ${viewer === "owner" ? "your" : ownersName(ownerName)} time`;
  }
}
