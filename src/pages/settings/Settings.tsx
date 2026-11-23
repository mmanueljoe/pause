import { useState } from "react";
import { Navigate } from "react-router";
import { type Address as AddressType, isAddress } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { CircleAlert, Info } from "lucide-react";

import { useWithdrawalActions } from "../../components/payments/useWithdrawalActions";
import {
  Address,
  Button,
  Card,
  ChoiceCard,
  Countdown,
  Input,
  StatusLabel,
  useToast,
} from "../../components/ui";
import { Dialog } from "../../components/ui/Dialog";
import type { VaultState } from "../../lib/pause/accounts";
import {
  describeChange,
  formatDayTime,
  formatWait,
  fromUnix,
} from "../../lib/pause/format";
import {
  useVault,
  useVaultAddress,
  useWalletAddress,
} from "../../lib/pause/hooks";
import {
  changeWithdrawalWaitInstruction,
  proposeGuardianChangeInstruction,
} from "../../lib/pause/instructions";
import { useSendPause } from "../../lib/pause/send";
import { WAIT_UNIT_NAME, WAIT_UNIT_SECS } from "../../lib/pause/constants";
import {
  MAX_UNITS,
  plural,
  unitsOf,
  WAIT_CHOICES,
  type WaitChoice,
} from "../../lib/pause/waitChoices";
import type { AppClient } from "../../lib/solana/client";
import { useNow } from "../../lib/useNow";

/** Screen 11: Settings (US-10, US-11). Owner only. */
export function Settings() {
  const wallet = useWalletAddress();
  const vaultAddress = useVaultAddress(wallet);
  const { vault, isLoading } = useVault(vaultAddress);

  if (!wallet) return <Navigate to="/" replace />;
  if (isLoading || !vaultAddress) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Loading your settings…
      </p>
    );
  }
  if (!vault) return <Navigate to="/setup" replace />;
  return <SettingsView vault={vault} />;
}

type Editing = "wait" | "guardian" | "remove" | null;

/** The settings layout, given the vault. Split out so it can be previewed. */
export function SettingsView({ vault }: { vault: VaultState }) {
  const [editing, setEditing] = useState<Editing>(null);
  const guardianWait = formatWait(vault.data.guardianWaitSecs);
  const pending = vault.data.pendingChange.__option === "Some";
  const guardian =
    vault.data.guardian.__option === "Some" ? vault.data.guardian.value : null;
  const blocked = pending
    ? "Another change is waiting. Cancel it or let it apply first."
    : null;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 py-12">
      <h1 className="text-h1 font-semibold md:text-h1-lg">Settings</h1>

      {pending && <PendingChange vault={vault} />}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-small text-text-2">Withdrawals wait</span>
            <span className="text-h3 font-semibold md:text-h3-lg">
              {formatWait(vault.data.withdrawalWaitSecs)}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={() => setEditing("wait")}
            disabled={pending}
          >
            Change
          </Button>
        </div>
        <Note>
          Making the wait longer happens now. Making it shorter waits{" "}
          {guardianWait}, and your guardian can stop it.
        </Note>
      </Card>

      <Card className="flex flex-col gap-4">
        <span className="text-small text-text-2">Your guardian</span>
        {guardian ? (
          <Address value={guardian} />
        ) : (
          <p className="flex items-start gap-2">
            <CircleAlert
              size={20}
              strokeWidth={1.5}
              className="shrink-0"
              aria-hidden
            />
            You have no guardian. Nobody else can stop a withdrawal, and nobody
            can approve one early.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setEditing("guardian")}
            disabled={pending}
          >
            {guardian ? "Change guardian" : "Add a guardian"}
          </Button>
          {guardian && (
            <Button
              variant="link"
              onClick={() => setEditing("remove")}
              disabled={pending}
            >
              Remove guardian
            </Button>
          )}
        </div>
        <Note>
          {guardian
            ? `Changing or removing your guardian waits ${guardianWait}. Your guardian can stop it.`
            : `Adding a guardian waits ${guardianWait}, so a thief can't add their own.`}
        </Note>
      </Card>

      {blocked && <p className="text-small text-text-2">{blocked}</p>}

      {editing === "wait" && (
        <WaitDialog vault={vault} onClose={() => setEditing(null)} />
      )}
      {editing === "guardian" && (
        <GuardianDialog vault={vault} onClose={() => setEditing(null)} />
      )}
      {editing === "remove" && (
        <RemoveDialog vault={vault} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-small text-text-2">
      <Info size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** The waiting change on top: countdown, Cancel this change, Apply it now when due. */
function PendingChange({ vault }: { vault: VaultState }) {
  const now = useNow();
  const actions = useWithdrawalActions(vault);
  const [pending, setPending] = useState<"cancel" | "apply" | null>(null);
  if (vault.data.pendingChange.__option === "None") return null;
  const change = vault.data.pendingChange.value;
  const applyAfter = fromUnix(change.applyAfter);
  const due = now >= applyAfter;

  async function act(which: "cancel" | "apply") {
    setPending(which);
    await (which === "cancel" ? actions.cancelChange() : actions.applyChange());
    setPending(null);
  }

  return (
    <section
      aria-label="Waiting change"
      className="flex flex-col gap-6 rounded-card border border-waiting/40 bg-waiting-soft p-6"
    >
      <div className="flex flex-col items-start gap-3">
        <StatusLabel status="waiting">{`Change waiting · applies ${formatDayTime(applyAfter)}`}</StatusLabel>
        <h2 className="text-h2 font-semibold md:text-h2-lg">
          Your wallet asked to{" "}
          {describeChange(change.kind, vault.data.guardian.__option === "Some")}
          .
        </h2>
        <p className="text-text-2">
          {due
            ? "The wait is over. Apply it now, or cancel it."
            : "If this wasn't you, cancel it now. Your guardian can cancel it too."}
        </p>
      </div>
      {!due && (
        <Countdown
          startedAt={fromUnix(change.proposedAt)}
          endsAt={applyAfter}
        />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {due && (
          <Button
            size="large"
            className="sm:flex-1"
            onClick={() => act("apply")}
            loading={actions.isSending && pending === "apply"}
            disabled={actions.isSending}
          >
            Apply it now
          </Button>
        )}
        <Button
          variant="stop"
          size="large"
          className="sm:flex-1"
          onClick={() => act("cancel")}
          loading={actions.isSending && pending === "cancel"}
          disabled={actions.isSending}
        >
          Cancel this change
        </Button>
      </div>
      {actions.error && (
        <p className="text-small text-error" role="alert">
          {actions.error}
        </p>
      )}
    </section>
  );
}

/** Sends one settings instruction and closes on success. */
function useSettingsSend(onClose: () => void) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const toast = useToast();
  const { send, isSending } = useSendPause();
  const [error, setError] = useState<string | null>(null);

  async function submit(
    build: (
      signer: NonNullable<NonNullable<typeof connected>["signer"]>
    ) => ReturnType<typeof changeWithdrawalWaitInstruction>,
    success: string
  ) {
    if (!connected?.signer) return;
    setError(null);
    const result = await send([await build(connected.signer)]);
    if ("error" in result) {
      setError(result.error.message);
      return;
    }
    toast("success", success);
    onClose();
  }
  return { submit, isSending, error };
}

function WaitDialog({
  vault,
  onClose,
}: {
  vault: VaultState;
  onClose: () => void;
}) {
  const current = Number(vault.data.withdrawalWaitSecs);
  const currentUnits = current / WAIT_UNIT_SECS;
  const [wait, setWait] = useState<WaitChoice>(
    WAIT_CHOICES.some((c) => c.units === currentUnits) &&
      Number.isInteger(currentUnits)
      ? { kind: "preset", units: currentUnits }
      : {
          kind: "custom",
          input: Number.isInteger(currentUnits) ? String(currentUnits) : "",
        }
  );
  const { submit, isSending, error } = useSettingsSend(onClose);
  const units = unitsOf(wait);
  const secs = units === null ? null : units * WAIT_UNIT_SECS;
  const selected = wait.kind === "preset" ? String(wait.units) : "custom";
  const longer = secs !== null && secs > current;
  const same = secs === current;
  const guardianWait = formatWait(vault.data.guardianWaitSecs);

  return (
    <Dialog
      title="How long should withdrawals wait?"
      onClose={onClose}
      closable={!isSending}
    >
      <fieldset className="-mt-2 grid gap-2">
        <legend className="sr-only">Withdrawal wait</legend>
        {WAIT_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.units}
            name="wait"
            value={String(choice.units)}
            checked={selected === String(choice.units)}
            onChange={() => setWait({ kind: "preset", units: choice.units })}
            title={plural(choice.units)}
            tag={choice.units * WAIT_UNIT_SECS === current ? "Now" : undefined}
          />
        ))}
        <ChoiceCard
          name="wait"
          value="custom"
          checked={selected === "custom"}
          onChange={() =>
            setWait({
              kind: "custom",
              input: wait.kind === "custom" ? wait.input : "",
            })
          }
          title="Custom"
        />
      </fieldset>
      {wait.kind === "custom" && (
        <Input
          label={`How many ${WAIT_UNIT_NAME}s?`}
          inputMode="numeric"
          value={wait.input}
          onChange={(e) =>
            setWait({
              kind: "custom",
              input: e.target.value.replace(/\D/g, ""),
            })
          }
          help={`From 1 to ${MAX_UNITS} ${WAIT_UNIT_NAME}s.`}
          error={
            wait.input !== "" && units === null
              ? `Enter a whole number from 1 to ${MAX_UNITS}.`
              : undefined
          }
        />
      )}

      {secs !== null && !same && (
        <p className="rounded-input border border-line bg-surface-2 p-4">
          {longer
            ? "Safer. This happens now."
            : `Less safe, so this waits ${guardianWait}. Your guardian can stop it.`}
        </p>
      )}
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <Button
        fullWidth
        disabled={secs === null || same}
        loading={isSending}
        onClick={() =>
          secs !== null &&
          submit(
            (owner) =>
              changeWithdrawalWaitInstruction({ owner, newWaitSecs: secs }),
            longer
              ? "Withdrawals now wait longer."
              : "Change requested. It waits, and your guardian can stop it."
          )
        }
      >
        {same ? "That's your wait now" : longer ? "Save" : "Request change"}
      </Button>
    </Dialog>
  );
}

function GuardianDialog({
  vault,
  onClose,
}: {
  vault: VaultState;
  onClose: () => void;
}) {
  const current =
    vault.data.guardian.__option === "Some" ? vault.data.guardian.value : null;
  const [input, setInput] = useState("");
  const { submit, isSending, error } = useSettingsSend(onClose);
  const value = input.trim();
  const fieldError =
    value === ""
      ? undefined
      : !isAddress(value)
        ? "That isn't a Solana address. Check you copied all of it."
        : value === vault.data.owner
          ? "Your guardian can't be your own wallet."
          : value === current
            ? "That's your guardian now."
            : undefined;
  const guardianWait = formatWait(vault.data.guardianWaitSecs);

  return (
    <Dialog
      title={current ? "Change your guardian" : "Add a guardian"}
      onClose={onClose}
      closable={!isSending}
    >
      <Input
        label="Their Solana wallet address"
        placeholder="Paste their address"
        mono
        autoComplete="off"
        spellCheck={false}
        value={input}
        onChange={(e) => setInput(e.target.value.trim())}
        error={fieldError}
        disabled={isSending}
      />
      <p className="rounded-input border border-line bg-surface-2 p-4">
        {current
          ? `This waits ${guardianWait}. Your current guardian can stop it until then.`
          : `This waits ${guardianWait}, so a thief with your key can't add their own guardian.`}
      </p>
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <Button
        fullWidth
        disabled={value === "" || Boolean(fieldError)}
        loading={isSending}
        onClick={() =>
          submit(
            (owner) =>
              proposeGuardianChangeInstruction({
                owner,
                newGuardian: value as AddressType,
              }),
            "Change requested. It applies after the wait."
          )
        }
      >
        Request change
      </Button>
    </Dialog>
  );
}

function RemoveDialog({
  vault,
  onClose,
}: {
  vault: VaultState;
  onClose: () => void;
}) {
  const { submit, isSending, error } = useSettingsSend(onClose);
  const guardianWait = formatWait(vault.data.guardianWaitSecs);
  return (
    <Dialog
      title="Remove your guardian?"
      onClose={onClose}
      closable={!isSending}
    >
      <p className="-mt-2 text-text-2">
        Without a guardian, withdrawals still wait, but nobody else can stop
        one, and nobody can approve one early. A rescue wouldn't be possible.
      </p>
      <p>This waits {guardianWait}. Your guardian can stop it until then.</p>
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button
          fullWidth
          loading={isSending}
          onClick={() =>
            submit(
              (owner) =>
                proposeGuardianChangeInstruction({ owner, newGuardian: null }),
              "Removal requested. It applies after the wait."
            )
          }
        >
          Request removal
        </Button>
        <Button
          variant="secondary"
          fullWidth
          onClick={onClose}
          disabled={isSending}
        >
          Keep my guardian
        </Button>
      </div>
    </Dialog>
  );
}
