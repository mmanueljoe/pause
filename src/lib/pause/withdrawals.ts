import type { WithdrawalState } from "./accounts";

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
