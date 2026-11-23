import { useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { Info } from "lucide-react";

import { Button, Input, useToast } from "../../components/ui";
import { Dialog } from "../../components/ui/Dialog";
import {
  formatSol,
  formatWait,
  lamportsToInput,
  parseSol,
} from "../../lib/pause/format";
import { useWalletBalance, useWalletAddress } from "../../lib/pause/hooks";
import { depositInstruction } from "../../lib/pause/instructions";
import { useSendPause } from "../../lib/pause/send";
import type { AppClient } from "../../lib/solana/client";

/** Max leaves this much in the wallet for Solana fees (handover). */
const FEE_RESERVE = 10_000_000n; // 0.01 SOL

/** Screen 6: Deposit. Modal on laptop, sheet on phone (US-4). */
export function DepositDialog({
  withdrawalWaitSecs,
  onClose,
}: {
  withdrawalWaitSecs: bigint;
  onClose: () => void;
}) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const walletBalance = useWalletBalance(useWalletAddress());
  const { send, isSending } = useSendPause();
  const toast = useToast();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amount = parseSol(input);
  const max =
    walletBalance !== null && walletBalance > FEE_RESERVE
      ? walletBalance - FEE_RESERVE
      : 0n;
  const tooMuch =
    amount !== null &&
    walletBalance !== null &&
    amount > walletBalance - 5_000n;
  const inputError =
    input !== "" && amount === null
      ? "Enter an amount, like 2 or 0.5."
      : tooMuch
        ? "More than your wallet balance. Enter a smaller amount."
        : undefined;

  async function deposit() {
    if (!amount || !connected?.signer) return;
    setError(null);
    const result = await send([
      await depositInstruction({
        owner: connected.signer,
        amountLamports: amount,
      }),
    ]);
    if ("error" in result) {
      setError(result.error.message);
      return;
    }
    toast("success", `${formatSol(amount)} is in your vault.`);
    onClose();
  }

  return (
    <Dialog
      title="Move SOL into your vault"
      onClose={onClose}
      closable={!isSending}
    >
      <p className="-mt-2 flex items-start gap-2 text-small text-text-2">
        <Info size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
        Deposits are instant. Taking money out waits{" "}
        {formatWait(withdrawalWaitSecs)}.
      </p>

      <div className="flex flex-col gap-2">
        <Input
          label="Amount"
          placeholder="0 SOL"
          inputMode="decimal"
          autoFocus
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^\d.]/g, ""))}
          error={inputError}
          disabled={isSending}
        />
        <div className="flex items-center justify-between">
          <span className="text-small text-text-2">
            In your wallet:{" "}
            {walletBalance === null ? "…" : formatSol(walletBalance)}
          </span>
          <Button
            variant="link"
            onClick={() => setInput(lamportsToInput(max))}
            disabled={isSending || max === 0n}
          >
            Max
          </Button>
        </div>
        <p className="text-small text-text-3">
          Max keeps 0.01 SOL in your wallet for Solana fees. Keep some spending
          money there too.
        </p>
      </div>

      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}

      <Button
        fullWidth
        onClick={deposit}
        loading={isSending}
        disabled={!amount || Boolean(inputError) || !connected?.signer}
      >
        {amount && !inputError ? `Deposit ${formatSol(amount)}` : "Deposit"}
      </Button>
    </Dialog>
  );
}
