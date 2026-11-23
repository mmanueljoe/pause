import { type ReactNode, useState } from "react";
import { Link, useParams } from "react-router";
import { type Address, isAddress } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { ChevronLeft, ExternalLink } from "lucide-react";

import {
  Address as AddressText,
  Button,
  Card,
  Countdown,
  NewAddressTag,
  StatusLabel,
  useToast,
} from "../../components/ui";
import { Dialog } from "../../components/ui/Dialog";
import type { VaultState, WithdrawalState } from "../../lib/pause/accounts";
import { explorerUrl } from "../../lib/pause/addresses";
import {
  formatArrival,
  formatDayTime,
  formatSol,
  formatTime,
  formatUsd,
  fromUnix,
  shortAddress,
} from "../../lib/pause/format";
import {
  useSolPrice,
  useVault,
  useWalletAddress,
  useWithdrawal,
  useWithdrawalAddress,
  useWithdrawals,
} from "../../lib/pause/hooks";
import {
  approveWithdrawalInstruction,
  releaseWithdrawalInstruction,
  stopWithdrawalInstruction,
} from "../../lib/pause/instructions";
import { useSendPause } from "../../lib/pause/send";
import {
  paidAddresses,
  type UrgentReason,
  urgentReasons,
} from "../../lib/pause/withdrawals";
import type { AppClient } from "../../lib/solana/client";
import { useNow } from "../../lib/useNow";

type Viewer = "owner" | "guardian" | "other";

/** Screen 8: one withdrawal (US-8, US-8a, US-9). Live. */
export function PaymentDetail() {
  const params = useParams();
  const vaultAddress =
    params.vault && isAddress(params.vault) ? (params.vault as Address) : null;
  const id = params.id && /^\d+$/.test(params.id) ? BigInt(params.id) : null;

  const { vault, slot, isLoading: vaultLoading } = useVault(vaultAddress);
  const withdrawalAddress = useWithdrawalAddress(vaultAddress, id);
  const { withdrawal, isLoading } = useWithdrawal(withdrawalAddress);
  const { withdrawals } = useWithdrawals(vaultAddress, slot);
  const wallet = useWalletAddress();

  if (!vaultAddress || id === null) return <Missing />;
  if (vaultLoading || isLoading || !withdrawalAddress) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Loading this payment…
      </p>
    );
  }
  if (!vault || !withdrawal) return <Missing />;

  const viewer: Viewer =
    wallet === vault.data.owner
      ? "owner"
      : wallet !== null &&
          vault.data.guardian.__option === "Some" &&
          vault.data.guardian.value === wallet
        ? "guardian"
        : "other";

  return (
    <PaymentDetailView
      vault={vault}
      withdrawal={withdrawal}
      all={withdrawals}
      viewer={viewer}
    />
  );
}

function Missing() {
  return (
    <div className="mx-auto max-w-[640px] py-24 text-center">
      <h1 className="text-h1 font-semibold md:text-h1-lg">
        This payment doesn't exist.
      </h1>
      <Link
        to="/"
        className="focus-ring mt-4 inline-block rounded text-text-2 underline hover:text-text"
      >
        Go to Pause
      </Link>
    </div>
  );
}

/** The detail layout, given the data. Split out so every state can be previewed. */
export function PaymentDetailView({
  vault,
  withdrawal,
  all,
  viewer,
}: {
  vault: VaultState;
  withdrawal: WithdrawalState;
  all: WithdrawalState[];
  viewer: Viewer;
}) {
  const now = useNow();
  const solPrice = useSolPrice();
  const [approving, setApproving] = useState(false);
  const { data } = withdrawal;
  const status = data.status;
  const waiting = status.__kind === "Waiting";
  const amount = formatSol(data.amountLamports);
  const requestedAt = fromUnix(data.requestedAt);
  const releaseAt = fromUnix(data.releaseAt);
  const waitOver = now >= releaseAt;
  const isNew = !paidAddresses(all).has(data.recipient);
  const reasons = waiting ? urgentReasons(withdrawal, vault, all) : [];
  const toOwner = data.recipient === vault.data.owner;
  const hasGuardian = vault.data.guardian.__option === "Some";
  const usd = formatUsd(data.amountLamports, solPrice);

  const back =
    viewer === "owner"
      ? { to: "/vault", label: "Your vault" }
      : viewer === "guardian"
        ? { to: "/guardian", label: "Vaults you protect" }
        : { to: "/", label: "Pause" };

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-8 py-12">
      <Link
        to={back.to}
        className="focus-ring flex items-center gap-1 self-start rounded text-small text-text-2 hover:text-text"
      >
        <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        {back.label}
      </Link>

      <div className="flex flex-col items-start gap-3">
        <Status
          status={status}
          viewer={viewer}
          releaseAt={releaseAt}
          now={now}
        />
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          {heading({
            status: status.__kind,
            viewer,
            amount,
            toOwner,
            isNew,
            recipient: data.recipient,
          })}
        </h1>
        {waiting && (
          <p className="text-text-2">
            {viewer === "guardian"
              ? "Did the owner ask for this? If you're not sure, call them before you decide."
              : viewer === "owner"
                ? reasons.length > 0
                  ? `Was this you? If not, stop it now. It arrives ${formatArrival(releaseAt, now)} if no one stops it.`
                  : `Arrives ${formatArrival(releaseAt, now)}. You can stop it until then.${hasGuardian ? " Need it sooner? Ask your guardian to approve it." : ""}`
                : `Arrives ${formatArrival(releaseAt, now)} unless the owner or guardian stops it.`}
          </p>
        )}
      </div>

      {(waiting || status.__kind === "Stopped") && (
        <Countdown
          startedAt={requestedAt}
          endsAt={releaseAt}
          stopped={status.__kind === "Stopped"}
          stoppedText={
            viewer === "owner"
              ? "Stopped. Still in your vault."
              : "Stopped. Still in the vault."
          }
        />
      )}

      {reasons.length > 0 && viewer !== "other" && (
        <Reasons reasons={reasons} />
      )}

      {waiting && (
        <Actions
          vault={vault}
          withdrawal={withdrawal}
          viewer={viewer}
          waitOver={waitOver}
          onApprove={() => setApproving(true)}
        />
      )}

      <Card className="flex flex-col gap-4">
        <Row label="Amount">
          <span className="font-mono text-small whitespace-pre">
            {amount}
            {usd ? `  ${usd}` : ""}
          </span>
        </Row>
        <Row label="To">
          <span className="flex items-center gap-2">
            {isNew && waiting && <NewAddressTag />}
            <AddressText value={data.recipient} />
          </span>
        </Row>
        {viewer !== "owner" && (
          <Row label="From">
            <span className="text-small">
              Vault of{" "}
              <span className="font-mono">
                {shortAddress(vault.data.owner)}
              </span>
            </span>
          </Row>
        )}
        <Row label="Requested">{formatDayTime(requestedAt)}</Row>
        {waiting ? (
          <Row
            label={
              viewer === "owner" ? "Arrives" : "Arrives if no one stops it"
            }
          >
            {formatDayTime(releaseAt)}
          </Row>
        ) : (
          <Row label={finishedLabel(status.__kind)}>
            {formatDayTime(fromUnix(status.at))}
          </Row>
        )}
        <a
          href={explorerUrl("address", withdrawal.address)}
          target="_blank"
          rel="noreferrer"
          className="focus-ring flex items-center gap-1 self-start rounded text-small text-text-2 hover:text-text"
        >
          View it on Solana
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
        </a>
      </Card>

      {approving && (
        <ApproveDialog
          vault={vault}
          withdrawal={withdrawal}
          onClose={() => setApproving(false)}
        />
      )}
    </div>
  );
}

function heading(p: {
  status: WithdrawalState["data"]["status"]["__kind"];
  viewer: Viewer;
  amount: string;
  toOwner: boolean;
  isNew: boolean;
  recipient: Address;
}): string {
  const where = p.toOwner ? "the owner's wallet" : shortAddress(p.recipient);
  switch (p.status) {
    case "Waiting":
      if (p.viewer === "owner") {
        return p.toOwner
          ? `${p.amount} to your wallet`
          : `${p.amount} to ${shortAddress(p.recipient)}`;
      }
      return p.isNew
        ? `The owner is sending ${p.amount} to a new address.`
        : `The owner is sending ${p.amount} to ${where}.`;
    case "Stopped":
      return p.viewer === "owner"
        ? `Stopped. ${p.amount} is still in your vault.`
        : `Stopped. ${p.amount} is still in the vault.`;
    case "Released":
      return `${p.amount} arrived.`;
    case "ApprovedEarly":
      return p.viewer === "guardian"
        ? `You sent ${p.amount} early.`
        : `${p.amount} was sent early.`;
  }
}

function finishedLabel(kind: string): string {
  return kind === "Stopped"
    ? "Stopped"
    : kind === "Released"
      ? "Arrived"
      : "Sent early";
}

function Status({
  status,
  viewer,
  releaseAt,
  now,
}: {
  status: WithdrawalState["data"]["status"];
  viewer: Viewer;
  releaseAt: Date;
  now: Date;
}) {
  switch (status.__kind) {
    case "Waiting": {
      const sameDay = releaseAt.toDateString() === now.toDateString();
      return (
        <StatusLabel status="waiting">
          {`Paused · arrives ${sameDay ? formatTime(releaseAt) : formatArrival(releaseAt, now)}`}
        </StatusLabel>
      );
    }
    case "Stopped":
      return (
        <StatusLabel status="stopped">Stopped. Still in the vault.</StatusLabel>
      );
    case "Released":
      return <StatusLabel status="arrived">Arrived</StatusLabel>;
    case "ApprovedEarly":
      return (
        <StatusLabel status="approved-early">
          {viewer === "guardian"
            ? "You sent it early"
            : "Your guardian sent it early"}
        </StatusLabel>
      );
  }
}

function Reasons({ reasons }: { reasons: UrgentReason[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small text-text-2">Why this looks urgent</p>
      <ul className="flex flex-wrap gap-2">
        {reasons.map((reason) => (
          <li key={reason.kind}>
            {reason.kind === "new-address" ? (
              <NewAddressTag />
            ) : (
              <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-small text-text-2">
                {reason.kind === "share"
                  ? `${reason.percent}% of the savings`
                  : "Another payment is waiting"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-text-2">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** Stop (owner, guardian), Approve now (guardian), Release (anyone, after the wait). */
function Actions({
  vault,
  withdrawal,
  viewer,
  waitOver,
  onApprove,
}: {
  vault: VaultState;
  withdrawal: WithdrawalState;
  viewer: Viewer;
  waitOver: boolean;
  onApprove: () => void;
}) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const toast = useToast();
  const stop = useSendPause();
  const release = useSendPause();
  const [error, setError] = useState<string | null>(null);
  const busy = stop.isSending || release.isSending;

  async function onStop() {
    if (!connected?.signer) return;
    setError(null);
    const result = await stop.send([
      await stopWithdrawalInstruction({
        authority: connected.signer,
        vault: vault.address,
        withdrawal: withdrawal.address,
      }),
    ]);
    if ("error" in result) setError(result.error.message);
    else toast("stopped", "Stopped. Still in the vault.");
  }

  async function onRelease() {
    setError(null);
    const result = await release.send([
      await releaseWithdrawalInstruction({
        vault: vault.address,
        withdrawal: withdrawal.address,
        recipient: withdrawal.data.recipient,
      }),
    ]);
    if ("error" in result) setError(result.error.message);
    else
      toast("success", `Sent to ${shortAddress(withdrawal.data.recipient)}.`);
  }

  const canStop = viewer === "owner" || viewer === "guardian";
  return (
    <div className="flex flex-col gap-3">
      {waitOver && connected && (
        <>
          <p className="text-small text-text-2">
            The wait is over. Send it now. It can only go to{" "}
            <span className="font-mono">
              {shortAddress(withdrawal.data.recipient)}
            </span>
            .
          </p>
          <Button
            size="large"
            fullWidth
            onClick={onRelease}
            loading={release.isSending}
            disabled={busy}
          >
            Send it now
          </Button>
        </>
      )}
      {canStop && (
        <Button
          variant="stop"
          size="large"
          fullWidth
          onClick={onStop}
          loading={stop.isSending}
          disabled={busy}
        >
          Stop this payment
        </Button>
      )}
      {viewer === "guardian" && (
        <>
          <Button
            variant="approve"
            size="large"
            fullWidth
            onClick={onApprove}
            disabled={busy}
          >
            Approve now
          </Button>
          <p className="text-small text-text-3">
            Only approve if the owner told you themselves, by call or in person.
          </p>
        </>
      )}
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Approve now can't be undone, so it asks first (FR-11a). Stop never asks. */
export function ApproveDialog({
  vault,
  withdrawal,
  onClose,
}: {
  vault: VaultState;
  withdrawal: WithdrawalState;
  onClose: () => void;
}) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const toast = useToast();
  const { send, isSending } = useSendPause();
  const [error, setError] = useState<string | null>(null);
  const amount = formatSol(withdrawal.data.amountLamports);

  async function approve() {
    if (!connected?.signer) return;
    setError(null);
    const result = await send([
      await approveWithdrawalInstruction({
        guardian: connected.signer,
        vault: vault.address,
        withdrawal: withdrawal.address,
        recipient: withdrawal.data.recipient,
      }),
    ]);
    if ("error" in result) {
      setError(result.error.message);
      return;
    }
    toast(
      "success",
      `Sent ${amount} to ${shortAddress(withdrawal.data.recipient)}.`
    );
    onClose();
  }

  return (
    <Dialog
      title={`Send ${amount} now?`}
      onClose={onClose}
      closable={!isSending}
    >
      <p className="-mt-2 text-text-2">
        It leaves the vault at once and goes to{" "}
        <span className="font-mono text-small text-text">
          {shortAddress(withdrawal.data.recipient)}
        </span>
        . This can't be undone.
      </p>
      <p>
        Only approve if the owner told you themselves, by call or in person.
      </p>
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button
          variant="approve"
          size="large"
          fullWidth
          onClick={approve}
          loading={isSending}
        >
          Approve and send now
        </Button>
        <Button
          variant="secondary"
          size="large"
          fullWidth
          onClick={onClose}
          disabled={isSending}
        >
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
