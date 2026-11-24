import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { type Address, isAddress } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { ChevronLeft, Clock } from "lucide-react";

import { Button, ChoiceCard, Input, useToast } from "../../components/ui";
import { useVaultProfiles } from "../../lib/backend";
import {
  formatArrival,
  formatSol,
  lamportsToInput,
  parseSol,
  shortAddress,
} from "../../lib/pause/format";
import {
  useVault,
  useVaultAddress,
  useWalletAddress,
} from "../../lib/pause/hooks";
import { requestWithdrawalInstruction } from "../../lib/pause/instructions";
import { useSendPause } from "../../lib/pause/send";
import { MIN_WITHDRAWAL_LAMPORTS } from "../../lib/pause/withdrawals";
import type { AppClient } from "../../lib/solana/client";
import { useNow } from "../../lib/useNow";

/**
 * Screen 7: Withdraw (US-5). `?rescue=1` is the Rescue version (US-8b):
 * everything to a new wallet, then the guardian approves it now.
 */
export function Withdraw() {
  const wallet = useWalletAddress();
  const vaultAddress = useVaultAddress(wallet);
  const { vault, isLoading } = useVault(vaultAddress);
  const [params] = useSearchParams();
  const rescue = params.get("rescue") === "1";

  if (!wallet) return <Navigate to="/" replace />;
  if (isLoading || !vaultAddress) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Loading your vault…
      </p>
    );
  }
  if (!vault) return <Navigate to="/setup" replace />;

  return (
    <WithdrawForm
      key={rescue ? "rescue" : "withdraw"}
      owner={wallet}
      vaultAddress={vaultAddress}
      available={vault.available}
      nextWithdrawalId={vault.data.nextWithdrawalId}
      waitSecs={Number(vault.data.withdrawalWaitSecs)}
      guardian={
        vault.data.guardian.__option === "Some"
          ? vault.data.guardian.value
          : null
      }
      rescue={rescue}
    />
  );
}

export function WithdrawForm({
  owner,
  vaultAddress,
  available,
  nextWithdrawalId,
  waitSecs,
  guardian,
  rescue,
}: {
  owner: Address;
  vaultAddress: Address;
  available: bigint;
  nextWithdrawalId: bigint;
  waitSecs: number;
  guardian: Address | null;
  rescue: boolean;
}) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow(30_000);
  const { send, isSending } = useSendPause();
  const { profiles, loaded } = useVaultProfiles([vaultAddress]);
  const profile = profiles[vaultAddress];
  const guardianName = profile?.guardianName ?? null;
  // FR-8: say whether the guardian gets an email (only after accepting the invite).
  const guardianTold =
    guardian && loaded ? profile?.acceptedGuardians.includes(guardian) : null;

  const [destination, setDestination] = useState<"mine" | "other">(
    rescue ? "other" : "mine"
  );
  const [other, setOther] = useState("");
  const [amountInput, setAmountInput] = useState(
    rescue ? lamportsToInput(available) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const recipient = destination === "mine" ? owner : other.trim();
  const recipientError =
    destination === "other" && other.trim() !== ""
      ? !isAddress(other.trim())
        ? "That isn't a Solana address. Check you copied all of it."
        : other.trim() === vaultAddress
          ? "You can't send to the vault itself."
          : rescue && other.trim() === owner
            ? "Rescue needs a new wallet. A thief may have this one's recovery phrase."
            : undefined
      : undefined;

  const amount = parseSol(amountInput);
  const amountError =
    amountInput !== "" && amount === null
      ? "Enter an amount, like 2 or 0.5."
      : amount !== null && amount > available
        ? `Your vault has ${formatSol(available)} free to withdraw. Enter a smaller amount.`
        : amount !== null && amount < MIN_WITHDRAWAL_LAMPORTS
          ? "That's too small to send. The smallest is 0.001 SOL."
          : undefined;

  const ready =
    amount !== null &&
    !amountError &&
    isAddress(recipient) &&
    !recipientError &&
    Boolean(connected?.signer);

  async function withdraw() {
    if (!ready || !connected?.signer || amount === null) return;
    setError(null);
    const instruction = await requestWithdrawalInstruction({
      owner: connected.signer,
      vault: vaultAddress,
      nextWithdrawalId,
      recipient: recipient as Address,
      amountLamports: amount,
    });
    const result = await send([instruction]);
    if ("error" in result) {
      setError(result.error.message);
      return;
    }
    toast("success", "Your withdrawal is waiting.");
    navigate(`/vaults/${vaultAddress}/payments/${nextWithdrawalId}`);
  }

  const arrives = formatArrival(new Date(now.getTime() + waitSecs * 1000), now);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-8 py-12">
      <Link
        to="/vault"
        className="focus-ring flex items-center gap-1 self-start rounded text-small text-text-2 hover:text-text"
      >
        <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        Your vault
      </Link>

      <div className="flex flex-col gap-3">
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          {rescue ? "Rescue your savings" : "Withdraw from your vault"}
        </h1>
        {rescue && (
          <p className="text-text-2">
            Move everything to a new wallet that only you control. Then ask{" "}
            {guardianName ?? "your guardian"} to approve it now, so it arrives
            at once and nobody can stop it.
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-small text-text-2">
          Where should it go?
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {!rescue && (
            <ChoiceCard
              name="destination"
              value="mine"
              checked={destination === "mine"}
              onChange={() => setDestination("mine")}
              title="My wallet"
              description={`${shortAddress(owner)}, the wallet you are using now`}
            />
          )}
          <ChoiceCard
            name="destination"
            value="other"
            checked={destination === "other"}
            onChange={() => setDestination("other")}
            title={rescue ? "My new wallet" : "Another address"}
            description={
              rescue
                ? "A wallet with a new recovery phrase"
                : "Someone else, or another wallet of yours"
            }
          />
        </div>
      </fieldset>

      {destination === "other" && (
        <Input
          label={rescue ? "Your new wallet's address" : "Their Solana address"}
          placeholder="Paste the address"
          mono
          autoComplete="off"
          spellCheck={false}
          value={other}
          onChange={(e) => setOther(e.target.value.trim())}
          error={recipientError}
          disabled={isSending}
        />
      )}

      <div className="flex flex-col gap-2">
        <Input
          label="Amount"
          placeholder="0 SOL"
          inputMode="decimal"
          autoComplete="off"
          value={amountInput}
          onChange={(e) =>
            setAmountInput(e.target.value.replace(/[^\d.]/g, ""))
          }
          error={amountError}
          disabled={isSending}
        />
        <div className="flex items-center justify-between">
          <span className="text-small text-text-2">
            In your vault: {formatSol(available)}
          </span>
          <Button
            variant="link"
            onClick={() => setAmountInput(lamportsToInput(available))}
            disabled={isSending || available === 0n}
          >
            Everything
          </Button>
        </div>
      </div>

      {ready && (
        <div className="flex items-start gap-3 rounded-input border border-line bg-surface-1 p-4">
          <Clock
            size={20}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0"
            aria-hidden
          />
          <p>
            Arrives {arrives}.{" "}
            {rescue
              ? `Ask ${guardianName ?? "your guardian"} to approve it now, so it arrives at once.`
              : guardian
                ? guardianLine(guardianName, guardianTold)
                : "You can stop it until then."}
          </p>
        </div>
      )}

      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}

      <Button
        fullWidth
        onClick={withdraw}
        loading={isSending}
        disabled={!ready}
      >
        {amount !== null && !amountError
          ? `Withdraw ${formatSol(amount)}`
          : "Withdraw"}
      </Button>

      {!rescue && (
        <p className="text-small text-text-2">
          Lost your recovery phrase?{" "}
          <Link
            to="/vault/withdraw?rescue=1"
            className="focus-ring rounded text-text underline-offset-4 hover:underline"
          >
            Rescue your savings
          </Link>
        </p>
      )}
    </div>
  );
}

/** What the preview says about the guardian (FR-8). */
function guardianLine(
  name: string | null,
  told: boolean | null | undefined
): string {
  const who = name ?? "Your guardian";
  if (told === true) return `${who} will be told. They can stop it until then.`;
  if (told === false) {
    return `${who} can stop it until then. They can see it in Pause, but won't get an email until they accept your invite.`;
  }
  return `${who} can stop it until then.`;
}
