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
  | { kind: "another-waiting" };

/**
 * Why a waiting withdrawal looks like theft (docs/requirements.md, Alert
 * levels). Computed from Solana data. The night-time rule needs the owner's
 * time zone from the backend, so it isn't here yet.
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
