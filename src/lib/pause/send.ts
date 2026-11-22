import { useCallback } from "react";
import { type Instruction } from "@solana/kit";
import { useClient, useSendTransaction } from "@solana/react";

import type { AppClient } from "../solana/client";
import { type FriendlyError, toFriendlyError } from "./errors";

/**
 * Sends Pause instructions through the connected wallet.
 * `send` resolves with the transaction signature, or a friendly error.
 */
export function useSendPause() {
  const client = useClient<AppClient>();
  const { dispatchAsync, isRunning } = useSendTransaction(client);

  const send = useCallback(
    async (
      instructions: Instruction[]
    ): Promise<{ signature: string } | { error: FriendlyError }> => {
      try {
        const result = await dispatchAsync(instructions);
        return { signature: result.context.signature };
      } catch (error) {
        console.error("Pause transaction failed", error);
        return { error: toFriendlyError(error) };
      }
    },
    [dispatchAsync]
  );

  return { send, isSending: isRunning };
}
