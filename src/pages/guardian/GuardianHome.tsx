import { useState } from "react";
import { Link, Navigate } from "react-router";
import { ChevronRight } from "lucide-react";

import { ApproveDialog } from "../../components/payments/ApproveDialog";
import { useWithdrawalActions } from "../../components/payments/useWithdrawalActions";
import { WaitingRow } from "../../components/payments/WaitingRow";
import {
  Address,
  Button,
  Card,
  Countdown,
  NewAddressTag,
  StatusLabel,
} from "../../components/ui";
import type { VaultState, WithdrawalState } from "../../lib/pause/accounts";
import {
  describeChange,
  formatArrival,
  formatDayTime,
  formatSol,
  formatTime,
  formatWait,
  fromUnix,
  shortAddress,
} from "../../lib/pause/format";
import {
  useGuardedVaults,
  usePauseProgramChanges,
  useWalletAddress,
  useWithdrawalsOfVaults,
} from "../../lib/pause/hooks";
import {
  paidAddresses,
  type UrgentReason,
  urgentReasons,
} from "../../lib/pause/withdrawals";
import { useNow } from "../../lib/useNow";

/** Screen 10: vaults this wallet protects (US-7, US-8). Live. */
export function GuardianHome() {
  const wallet = useWalletAddress();
  const {
    vaults,
    isLoading,
    error,
    refresh: refreshVaults,
  } = useGuardedVaults(wallet);
  const { byVault, refresh: refreshWithdrawals } = useWithdrawalsOfVaults(
    vaults.map((v) => v.address)
  );
  usePauseProgramChanges(() => {
    void refreshVaults();
    void refreshWithdrawals();
  });

  if (!wallet) return <Navigate to="/" replace />;
  if (error) {
    return (
      <p className="py-24 text-center text-text-2" role="alert">
        Couldn't reach Solana to load the vaults you protect. Check your
        connection and reload.
      </p>
    );
  }
  if (isLoading) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Finding the vaults you protect…
      </p>
    );
  }
  return <GuardianHomeView vaults={vaults} byVault={byVault} />;
}

type Pinned =
  | {
      kind: "payment";
      vault: VaultState;
      withdrawal: WithdrawalState;
      reasons: UrgentReason[];
    }
  | { kind: "change"; vault: VaultState };

/** The guardian home layout, given the data. Split out so it can be previewed. */
export function GuardianHomeView({
  vaults,
  byVault,
}: {
  vaults: VaultState[];
  byVault: Map<string, WithdrawalState[]>;
}) {
  if (vaults.length === 0) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 py-12">
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          You're not anyone's guardian yet.
        </h1>
        <p className="text-text-2">
          When someone adds this wallet as their guardian, their vault shows
          here.
        </p>
      </div>
    );
  }

  // Anything that needs the guardian goes on top: urgent payments and less-safe changes.
  const pinned: Pinned[] = [];
  for (const vault of vaults) {
    if (vault.data.pendingChange.__option === "Some")
      pinned.push({ kind: "change", vault });
    const all = byVault.get(vault.address) ?? [];
    for (const w of all) {
      if (w.data.status.__kind !== "Waiting") continue;
      const reasons = urgentReasons(w, vault, all);
      if (reasons.length > 0)
        pinned.push({ kind: "payment", vault, withdrawal: w, reasons });
    }
  }
  const pinnedIds = new Set(
    pinned.flatMap((p) => (p.kind === "payment" ? [p.withdrawal.address] : []))
  );
  const n = vaults.length;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          You're protecting {n} {n === 1 ? "vault" : "vaults"}
        </h1>
        <p className="text-text-2">
          {pinned.length === 0
            ? "Nothing needs you right now. Payments that look like theft show here first."
            : `${pinned.length} ${pinned.length === 1 ? "thing needs" : "things need"} you now.`}
        </p>
      </div>

      {pinned.map((item) =>
        item.kind === "payment" ? (
          <UrgentPayment
            key={item.withdrawal.address}
            vault={item.vault}
            withdrawal={item.withdrawal}
            reasons={item.reasons}
          />
        ) : (
          <PendingChangeCard
            key={`change-${item.vault.address}`}
            vault={item.vault}
          />
        )
      )}

      {vaults.map((vault) => (
        <VaultCard
          key={vault.address}
          vault={vault}
          withdrawals={byVault.get(vault.address) ?? []}
          hide={pinnedIds}
        />
      ))}
    </div>
  );
}

/** An urgent waiting payment, pinned in amber with Stop and Approve now. */
function UrgentPayment({
  vault,
  withdrawal,
  reasons,
}: {
  vault: VaultState;
  withdrawal: WithdrawalState;
  reasons: UrgentReason[];
}) {
  const now = useNow();
  const actions = useWithdrawalActions(vault, withdrawal);
  const [approving, setApproving] = useState(false);
  const { data } = withdrawal;
  const releaseAt = fromUnix(data.releaseAt);
  const isNew = reasons.some((r) => r.kind === "new-address");
  const sameDay = releaseAt.toDateString() === now.toDateString();

  return (
    <section
      aria-label="Payment that needs you"
      className="flex flex-col gap-6 rounded-card border border-waiting/40 bg-waiting-soft p-6"
    >
      <div className="flex flex-col items-start gap-3">
        <StatusLabel status="waiting">
          {`Paused · arrives ${sameDay ? formatTime(releaseAt) : formatArrival(releaseAt, now)}`}
        </StatusLabel>
        <h2 className="text-h2 font-semibold md:text-h2-lg">
          The owner is sending {formatSol(data.amountLamports)} to{" "}
          {isNew ? "a new address" : shortAddress(data.recipient)}.
        </h2>
        <p className="text-text-2">
          Vault of{" "}
          <span className="font-mono text-small">
            {shortAddress(vault.data.owner)}
          </span>
          . Did they ask for this? If you're not sure, call them before you
          decide.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Why this looks urgent">
          {reasons.map((r) => (
            <li key={r.kind}>
              {r.kind === "new-address" ? (
                <NewAddressTag />
              ) : (
                <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-small text-text-2">
                  {r.kind === "share"
                    ? `${r.percent}% of the savings`
                    : "Another payment is waiting"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Countdown startedAt={fromUnix(data.requestedAt)} endsAt={releaseAt} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="stop"
          size="large"
          className="sm:flex-1"
          onClick={() => actions.stop()}
          loading={actions.isSending}
        >
          Stop this payment
        </Button>
        <Button
          variant="approve"
          size="large"
          onClick={() => setApproving(true)}
          disabled={actions.isSending}
        >
          Approve now
        </Button>
      </div>
      {actions.error && (
        <p className="text-small text-error" role="alert">
          {actions.error}
        </p>
      )}
      <Link
        to={`/vaults/${vault.address}/payments/${data.id}`}
        className="focus-ring flex items-center gap-1 self-start rounded text-small text-text-2 hover:text-text"
      >
        See all details
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
      </Link>

      {approving && (
        <ApproveDialog
          vault={vault}
          withdrawal={withdrawal}
          onClose={() => setApproving(false)}
        />
      )}
    </section>
  );
}

/** A less-safe settings change waiting to apply, with Stop this change (FR-15). */
function PendingChangeCard({ vault }: { vault: VaultState }) {
  const actions = useWithdrawalActions(vault);
  const change = vault.data.pendingChange;
  if (change.__option === "None") return null;
  const applyAfter = fromUnix(change.value.applyAfter);

  return (
    <section
      aria-label="Settings change that needs you"
      className="flex flex-col gap-6 rounded-card border border-waiting/40 bg-waiting-soft p-6"
    >
      <div className="flex flex-col items-start gap-3">
        <StatusLabel status="waiting">{`Change waiting · applies ${formatDayTime(applyAfter)}`}</StatusLabel>
        <h2 className="text-h2 font-semibold md:text-h2-lg">
          The owner wants to{" "}
          {describeChange(
            change.value.kind,
            vault.data.guardian.__option === "Some"
          )}
          .
        </h2>
        <p className="text-text-2">
          Vault of{" "}
          <span className="font-mono text-small">
            {shortAddress(vault.data.owner)}
          </span>
          . A thief with the owner's key would try exactly this. If they didn't
          tell you about it, stop it.
        </p>
      </div>
      <Countdown
        startedAt={fromUnix(change.value.proposedAt)}
        endsAt={applyAfter}
      />
      <Button
        variant="stop"
        size="large"
        fullWidth
        onClick={() => actions.cancelChange()}
        loading={actions.isSending}
      >
        Stop this change
      </Button>
      {actions.error && (
        <p className="text-small text-error" role="alert">
          {actions.error}
        </p>
      )}
    </section>
  );
}

/** One vault this wallet protects, with routine waiting withdrawals shown quietly. */
function VaultCard({
  vault,
  withdrawals,
  hide,
}: {
  vault: VaultState;
  withdrawals: WithdrawalState[];
  hide: Set<string>;
}) {
  const paid = paidAddresses(withdrawals);
  const routine = withdrawals
    .filter((w) => w.data.status.__kind === "Waiting" && !hide.has(w.address))
    .sort((a, b) => Number(a.data.releaseAt - b.data.releaseAt));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-h3 font-semibold md:text-h3-lg">Vault of</h2>
        <Address value={vault.data.owner} />
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="text-small text-text-2">Savings</dt>
          <dd className="font-mono text-small">{formatSol(vault.balance)}</dd>
        </div>
        <div>
          <dt className="text-small text-text-2">Withdrawals wait</dt>
          <dd>{formatWait(vault.data.withdrawalWaitSecs)}</dd>
        </div>
      </dl>
      <hr className="border-line" />
      {routine.length === 0 ? (
        <p className="text-small text-text-2">Nothing waiting to leave.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {routine.map((w) => (
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
  );
}
