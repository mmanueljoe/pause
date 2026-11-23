import { useState } from "react";
import { Link, Navigate } from "react-router";
import { CircleAlert } from "lucide-react";

import { WaitingRow } from "../../components/payments/WaitingRow";
import { paidAddresses } from "../../lib/pause/withdrawals";
import { Address, Button, Card } from "../../components/ui";
import type { VaultState, WithdrawalState } from "../../lib/pause/accounts";
import { formatSol, formatUsd, formatWait } from "../../lib/pause/format";
import {
  useSolPrice,
  useVault,
  useVaultAddress,
  useWalletAddress,
  useWithdrawals,
} from "../../lib/pause/hooks";
import { DepositDialog } from "./DepositDialog";

/** Screen 5: the owner's vault home (US-4, US-7). Updates live. */
export function VaultHome() {
  const wallet = useWalletAddress();
  const vaultAddress = useVaultAddress(wallet);
  const { vault, slot, isLoading, error } = useVault(vaultAddress);
  const { withdrawals } = useWithdrawals(vaultAddress, slot);

  if (!wallet) return <Navigate to="/" replace />;
  if (error) {
    return (
      <p className="py-24 text-center text-text-2" role="alert">
        Couldn't reach Solana to load your vault. Check your connection and
        reload.
      </p>
    );
  }
  if (isLoading || !vaultAddress) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Loading your vault…
      </p>
    );
  }
  if (!vault) return <Navigate to="/setup" replace />;

  return <VaultHomeView vault={vault} withdrawals={withdrawals} />;
}

/** The vault home layout, given the data. Split out so it can be previewed. */
export function VaultHomeView({
  vault,
  withdrawals,
}: {
  vault: VaultState;
  withdrawals: WithdrawalState[];
}) {
  const [depositing, setDepositing] = useState(false);
  const waiting = withdrawals
    .filter((w) => w.data.status.__kind === "Waiting")
    .sort((a, b) => Number(a.data.releaseAt - b.data.releaseAt));
  const paid = paidAddresses(withdrawals);

  return (
    <div className="grid items-start gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <BalanceCard vault={vault} onDeposit={() => setDepositing(true)} />
        <Card className="flex flex-col gap-3">
          <h2 className="text-h3 font-semibold md:text-h3-lg">
            Waiting to leave
          </h2>
          {waiting.length === 0 ? (
            <p className="text-text-2">
              Nothing is waiting. Withdrawals you ask for show here while they
              wait.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {waiting.map((w) => (
                <li key={w.address}>
                  <WaitingRow
                    withdrawal={w}
                    owner={vault.data.owner}
                    isNewAddress={!paid.has(w.data.recipient)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <GuardianCard vault={vault} />
        <Card className="flex flex-col gap-4">
          <p className="text-small text-text-2">Withdrawals wait</p>
          <p className="text-h3 font-semibold md:text-h3-lg">
            {formatWait(vault.data.withdrawalWaitSecs)}
          </p>
          <Link
            to="/settings"
            className="focus-ring self-start rounded underline-offset-4 hover:underline"
          >
            Change in Settings
          </Link>
        </Card>
      </div>

      {depositing && (
        <DepositDialog
          withdrawalWaitSecs={vault.data.withdrawalWaitSecs}
          onClose={() => setDepositing(false)}
        />
      )}
    </div>
  );
}

function BalanceCard({
  vault,
  onDeposit,
}: {
  vault: VaultState;
  onDeposit: () => void;
}) {
  const solPrice = useSolPrice();
  const usd = formatUsd(vault.balance, solPrice);
  const reserved = vault.data.reservedLamports;
  return (
    <Card className="flex flex-col gap-4">
      <p className="text-small text-text-2">Your savings</p>
      <div className="flex flex-col gap-1">
        <p className="font-mono text-countdown font-medium break-all md:text-countdown-lg">
          {formatSol(vault.balance)}
        </p>
        {usd && (
          <p className="text-small text-text-3">{usd} at today's SOL price</p>
        )}
        {reserved > 0n && (
          <p className="text-small text-text-3">
            {formatSol(reserved)} of this is waiting to leave.
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={onDeposit}>Deposit</Button>
        <Link
          to="/vault/withdraw"
          className="focus-ring inline-flex h-12 items-center rounded-full border border-line px-6 hover:bg-surface-2"
        >
          Withdraw
        </Link>
      </div>
    </Card>
  );
}

function GuardianCard({ vault }: { vault: VaultState }) {
  const guardian = vault.data.guardian;
  if (guardian.__option === "None") {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-small text-text-2">Your guardian</p>
        <p className="flex items-start gap-2">
          <CircleAlert
            size={20}
            strokeWidth={1.5}
            className="shrink-0"
            aria-hidden
          />
          You have no guardian. Withdrawals still wait, but nobody else can stop
          one, and nobody can approve one early.
        </p>
        <Link
          to="/settings"
          className="focus-ring self-start rounded underline-offset-4 hover:underline"
        >
          Add a guardian in Settings
        </Link>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4">
      <p className="text-small text-text-2">Your guardian</p>
      <Address value={guardian.value} />
      <p className="text-small text-text-2">
        They can stop any withdrawal while it waits, and approve one early.
      </p>
    </Card>
  );
}
