import { Link } from "react-router";
import { type Address } from "@solana/kit";
import { ChevronRight } from "lucide-react";

import type { WithdrawalState } from "../../lib/pause/accounts";
import {
  formatArrival,
  formatSol,
  formatTime,
  formatTimeLeft,
  fromUnix,
  shortAddress,
} from "../../lib/pause/format";
import { useNow } from "../../lib/useNow";
import { NewAddressTag, StatusLabel } from "../ui";

/**
 * One waiting withdrawal in a list: amount and recipient, the amber status
 * label, time left, a thin draining bar, and a link to its detail page.
 */
export function WaitingRow({
  withdrawal,
  owner,
  isNewAddress,
}: {
  withdrawal: WithdrawalState;
  owner: Address;
  isNewAddress: boolean;
}) {
  const now = useNow();
  const { data } = withdrawal;
  const startedAt = fromUnix(data.requestedAt);
  const releaseAt = fromUnix(data.releaseAt);
  const total = Math.max(1, releaseAt.getTime() - startedAt.getTime());
  const leftMs = Math.max(0, releaseAt.getTime() - now.getTime());
  const sameDay = releaseAt.toDateString() === now.toDateString();
  const toOwner = data.recipient === owner;

  return (
    <Link
      to={`/vaults/${data.vault}/payments/${data.id}`}
      className="focus-ring flex flex-col gap-3 rounded-input bg-surface-2 p-4 hover:bg-line/60"
    >
      <span className="flex items-start gap-3">
        <span className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {formatSol(data.amountLamports)} to{" "}
            {toOwner ? (
              "your wallet"
            ) : (
              <span className="font-mono text-small">
                {shortAddress(data.recipient)}
              </span>
            )}
          </span>
          {isNewAddress && <NewAddressTag />}
        </span>
        <span className="flex items-center gap-2 font-mono text-small whitespace-nowrap text-text-2">
          {leftMs > 0 ? formatTimeLeft(leftMs / 1000) : "Ready to send"}
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden />
        </span>
      </span>
      <span>
        <StatusLabel status="waiting">
          {`Paused · arrives ${sameDay ? formatTime(releaseAt) : formatArrival(releaseAt, now)}`}
        </StatusLabel>
      </span>
      <span
        aria-hidden
        className="h-1 w-full overflow-hidden rounded-[2px] bg-surface-2"
      >
        <span
          className="ml-auto block h-full rounded-[2px] bg-waiting transition-[width] duration-500"
          style={{ width: `${(leftMs / total) * 100}%` }}
        />
      </span>
    </Link>
  );
}
