import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { useState } from "react";

import type { VaultState, WithdrawalState } from "../../lib/pause/accounts";
import { formatSol, shortAddress } from "../../lib/pause/format";
import {
  approveWithdrawalInstruction,
  cancelChangeInstruction,
  releaseWithdrawalInstruction,
  stopWithdrawalInstruction,
} from "../../lib/pause/instructions";
import { useSendPause } from "../../lib/pause/send";
import type { AppClient } from "../../lib/solana/client";
import { useToast } from "../ui";

/**
 * Stop, Approve now, Release and Cancel change, shared by the payment detail
 * page and guardian home so both behave exactly the same.
 */
export function useWithdrawalActions(
  vault: VaultState,
  withdrawal?: WithdrawalState
) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const toast = useToast();
  const { send, isSending } = useSendPause();
  const [error, setError] = useState<string | null>(null);
  const signer = connected?.signer ?? null;

  async function run(
    build: () => Promise<Parameters<typeof send>[0][number]>,
    success: () => void
  ) {
    setError(null);
    const result = await send([await build()]);
    if ("error" in result) {
      setError(result.error.message);
      return false;
    }
    success();
    return true;
  }

  return {
    error,
    isSending,
    canSign: signer !== null,
    connected: connected !== null,

    stop: () =>
      signer && withdrawal
        ? run(
            () =>
              stopWithdrawalInstruction({
                authority: signer,
                vault: vault.address,
                withdrawal: withdrawal.address,
              }),
            () => toast("stopped", "Stopped. Still in the vault.")
          )
        : Promise.resolve(false),

    approve: () =>
      signer && withdrawal
        ? run(
            () =>
              approveWithdrawalInstruction({
                guardian: signer,
                vault: vault.address,
                withdrawal: withdrawal.address,
                recipient: withdrawal.data.recipient,
              }),
            () =>
              toast(
                "success",
                `Sent ${formatSol(withdrawal.data.amountLamports)} to ${shortAddress(withdrawal.data.recipient)}.`
              )
          )
        : Promise.resolve(false),

    release: () =>
      withdrawal
        ? run(
            () =>
              releaseWithdrawalInstruction({
                vault: vault.address,
                withdrawal: withdrawal.address,
                recipient: withdrawal.data.recipient,
              }),
            () =>
              toast(
                "success",
                `Sent to ${shortAddress(withdrawal.data.recipient)}.`
              )
          )
        : Promise.resolve(false),

    cancelChange: () =>
      signer
        ? run(
            () =>
              cancelChangeInstruction({
                authority: signer,
                vault: vault.address,
              }),
            () => toast("stopped", "Change stopped. Nothing changed.")
          )
        : Promise.resolve(false),
  };
}
