import { useEffect, useRef } from "react";

import { formatSol, shortAddress } from "../../lib/pause/format";
import {
  useVault,
  useVaultAddress,
  useWalletAddress,
  useWithdrawals,
} from "../../lib/pause/hooks";
import { useToast } from "../ui";

/**
 * FR-9 in the app: while Pause is open, toast when one of the connected
 * owner's withdrawals leaves the vault (released or approved early). Only
 * changes seen while open count, never what was already done at first load.
 * Mounted once, in the app shell.
 */
export function useArrivalToasts() {
  const toast = useToast();
  const wallet = useWalletAddress();
  const vaultAddress = useVaultAddress(wallet);
  const { vault, slot } = useVault(vaultAddress);
  const { withdrawals, isLoading } = useWithdrawals(
    vault ? vaultAddress : null,
    slot
  );
  const seen = useRef<{ vault: string; statuses: Map<string, string> } | null>(
    null
  );

  useEffect(() => {
    if (!vault || !vaultAddress) {
      seen.current = null;
      return;
    }
    if (isLoading && withdrawals.length === 0) return;
    const before = seen.current?.vault === vaultAddress ? seen.current : null;
    for (const w of withdrawals) {
      const now = w.data.status.__kind;
      if (
        before?.statuses.get(w.address) === "Waiting" &&
        (now === "Released" || now === "ApprovedEarly")
      ) {
        const amount = formatSol(w.data.amountLamports);
        toast(
          "success",
          w.data.recipient === vault.data.owner
            ? `${amount} arrived in your wallet`
            : `${amount} was sent to ${shortAddress(w.data.recipient)}`
        );
      }
    }
    seen.current = {
      vault: vaultAddress,
      statuses: new Map(
        withdrawals.map((w) => [w.address, w.data.status.__kind])
      ),
    };
  }, [vault, vaultAddress, withdrawals, isLoading, toast]);
}
