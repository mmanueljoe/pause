import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { type Address, isAddress } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { Check, CircleCheck, Clock, Info, X } from "lucide-react";

import {
  Address as AddressText,
  Button,
  Card,
  ChoiceCard,
  Input,
  Stepper,
} from "../../components/ui";
import { cx } from "../../components/ui/cx";
import { useConnectWallet } from "../../components/wallet/connect-context";
import {
  SETUP_GUARDIAN_WAIT_SECS,
  WAIT_UNIT_NAME,
  WAIT_UNIT_SECS,
} from "../../lib/pause/constants";
import { formatArrival } from "../../lib/pause/format";
import {
  useVault,
  useVaultAddress,
  useWalletAddress,
} from "../../lib/pause/hooks";
import { createVaultInstruction } from "../../lib/pause/instructions";
import { useSendPause } from "../../lib/pause/send";
import type { AppClient } from "../../lib/solana/client";
import { useNow } from "../../lib/useNow";
import {
  MAX_UNITS,
  plural,
  unitsOf,
  WAIT_CHOICES as CHOICES,
  type WaitChoice,
} from "../../lib/pause/waitChoices";

const STEPS = ["Wait time", "Guardian", "Review"];
/** Screens 3 and 4: create a vault in three steps (US-2, US-3). */
export function Setup() {
  const wallet = useWalletAddress();
  const ownVaultAddress = useVaultAddress(wallet);
  const { vault, isLoading } = useVault(ownVaultAddress);
  const openConnect = useConnectWallet();

  const [step, setStep] = useState(0);
  const [wait, setWait] = useState<WaitChoice>({ kind: "preset", units: 24 });
  const [guardian, setGuardian] = useState("");
  const [created, setCreated] = useState(false);

  if (!wallet) {
    return (
      <Column>
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          Create your vault
        </h1>
        <p className="text-text-2">
          Connect your wallet first. Your vault belongs to it.
        </p>
        <div>
          <Button onClick={openConnect}>Connect wallet</Button>
        </div>
      </Column>
    );
  }
  if (created)
    return <Created waitUnits={unitsOf(wait)} guardian={guardian as Address} />;
  if (isLoading || !ownVaultAddress) {
    return (
      <p className="py-24 text-center text-text-2" role="status">
        Checking your wallet…
      </p>
    );
  }
  // One vault per owner: anyone who already has one goes to it.
  if (vault) return <Navigate to="/vault" replace />;

  return (
    <Column>
      <Stepper steps={STEPS} current={step} />
      {step === 0 && (
        <WaitStep wait={wait} setWait={setWait} onNext={() => setStep(1)} />
      )}
      {step === 1 && (
        <GuardianStep
          owner={wallet}
          guardian={guardian}
          setGuardian={setGuardian}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <ReviewStep
          waitUnits={unitsOf(wait)!}
          guardian={guardian as Address}
          onEdit={setStep}
          onCreated={() => setCreated(true)}
        />
      )}
    </Column>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8 py-12">
      {children}
    </div>
  );
}

function Heading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-h1 font-semibold md:text-h1-lg">{title}</h1>
      {body && <p className="text-text-2">{body}</p>}
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>button]:max-sm:w-full">
      {children}
    </div>
  );
}

// ---------- Step 1: wait time ----------

export function WaitStep({
  wait,
  setWait,
  onNext,
}: {
  wait: WaitChoice;
  setWait: (w: WaitChoice) => void;
  onNext: () => void;
}) {
  const now = useNow(30_000);
  const units = unitsOf(wait);
  const selected = wait.kind === "preset" ? String(wait.units) : "custom";
  const customError =
    wait.kind === "custom" && wait.input !== "" && units === null
      ? `Enter a whole number from 1 to ${MAX_UNITS}.`
      : undefined;

  return (
    <>
      <Heading
        title="How long should withdrawals wait?"
        body="Every withdrawal waits this long. You or your guardian can stop it, and your guardian can approve it early."
      />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Withdrawal wait</legend>
        {CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.units}
            name="wait"
            value={String(choice.units)}
            checked={selected === String(choice.units)}
            onChange={() => setWait({ kind: "preset", units: choice.units })}
            title={plural(choice.units)}
            description={choice.description}
            tag={"tag" in choice ? choice.tag : undefined}
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
          description={
            WAIT_UNIT_NAME === "hour"
              ? "Choose up to 7 days."
              : "Choose any number of minutes, up to 7 days."
          }
        />
      </fieldset>

      {wait.kind === "custom" && (
        <Input
          label={`How many ${WAIT_UNIT_NAME}s?`}
          inputMode="numeric"
          autoFocus
          value={wait.input}
          onChange={(e) =>
            setWait({
              kind: "custom",
              input: e.target.value.replace(/\D/g, ""),
            })
          }
          help={`From 1 to ${MAX_UNITS} ${WAIT_UNIT_NAME}s.`}
          error={customError}
        />
      )}

      {units !== null && (
        <div className="flex items-center gap-3 rounded-input border border-line bg-surface-1 p-4">
          <Clock size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
          <p>
            If you asked for money now, it would arrive{" "}
            {formatArrival(
              new Date(now.getTime() + units * WAIT_UNIT_SECS * 1000),
              now
            )}
            .
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3 text-small text-text-2">
        <Note>
          In an emergency, your guardian can approve a withdrawal early.
        </Note>
        <Note>
          You can make the wait longer at any time. Making it shorter has to
          wait, and your guardian can stop it.
        </Note>
      </ul>

      <Footer>
        <Button onClick={onNext} disabled={units === null}>
          Continue
        </Button>
      </Footer>
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Info size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

// ---------- Step 2: guardian ----------

function guardianError(owner: Address, value: string): string | undefined {
  const v = value.trim();
  if (v === "") return undefined;
  if (!isAddress(v))
    return "That isn't a Solana address. Check you copied all of it.";
  if (v === owner) return "Your guardian can't be your own wallet.";
  return undefined;
}

export function GuardianStep({
  owner,
  guardian,
  setGuardian,
  onBack,
  onNext,
}: {
  owner: Address;
  guardian: string;
  setGuardian: (g: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const error = guardianError(owner, guardian);
  const valid = guardian.trim() !== "" && !error;

  return (
    <>
      <Heading
        title="Who should be able to stop a payment?"
        body="Pick someone you trust, like a brother, sister or close friend. They need their own Solana wallet."
      />
      <Input
        label="Their Solana wallet address"
        placeholder="Paste their address"
        mono
        autoComplete="off"
        spellCheck={false}
        value={guardian}
        onChange={(e) => setGuardian(e.target.value.trim())}
        onBlur={() => setTouched(true)}
        help="Ask them to copy it from their wallet app. It is a long code of letters and numbers."
        error={touched || guardian.length >= 32 ? error : undefined}
      />

      <Card className="grid gap-6 sm:grid-cols-2">
        <CanList
          title="Your guardian can"
          items={["Get alerts", "Stop a withdrawal", "Approve one early"]}
          can
        />
        <CanList
          title="Your guardian can't"
          items={["Spend or move your money", "Change your settings"]}
        />
      </Card>

      <Footer>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!valid}>
          Continue
        </Button>
      </Footer>
    </>
  );
}

function CanList({
  title,
  items,
  can = false,
}: {
  title: string;
  items: string[];
  can?: boolean;
}) {
  const Icon = can ? Check : X;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-2">{title}</p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Icon
              size={18}
              strokeWidth={1.5}
              className={cx(!can && "text-text-3")}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Step 3: review ----------

export function ReviewStep({
  waitUnits,
  guardian,
  onEdit,
  onCreated,
}: {
  waitUnits: number;
  guardian: Address;
  onEdit: (step: number) => void;
  onCreated: () => void;
}) {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const { send, isSending } = useSendPause();
  const [error, setError] = useState<string | null>(null);
  const walletName = connected?.wallet.name ?? "Your wallet";

  async function create() {
    if (!connected) return;
    if (!connected.signer) {
      setError(
        `${walletName} is connected read-only, so it can't approve. Reconnect it and try again.`
      );
      return;
    }
    setError(null);
    const instruction = await createVaultInstruction({
      owner: connected.signer,
      guardian,
      withdrawalWaitSecs: waitUnits * WAIT_UNIT_SECS,
      guardianWaitSecs: SETUP_GUARDIAN_WAIT_SECS,
    });
    const result = await send([instruction]);
    if ("error" in result) setError(result.error.message);
    else onCreated();
  }

  return (
    <>
      <Heading title="Check your vault" />
      <Card className="flex flex-col gap-4">
        <SummaryRow
          label="Withdrawals wait"
          onEdit={() => onEdit(0)}
          disabled={isSending}
        >
          {plural(waitUnits)}
        </SummaryRow>
        <hr className="border-line" />
        <SummaryRow
          label="Guardian"
          onEdit={() => onEdit(1)}
          disabled={isSending}
        >
          <span className="text-body font-normal">
            <AddressText value={guardian} />
          </span>
        </SummaryRow>
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-small text-text-2">What happens next</p>
        <ol className="flex flex-col gap-3">
          <NextStep n={1}>
            {walletName} asks you to approve. Creating a vault costs a small
            Solana fee, less than 0.01 SOL.
          </NextStep>
          <NextStep n={2}>
            Your vault is created on Solana. Your guardian can stop payments
            from that moment.
          </NextStep>
          <NextStep n={3}>Then you move savings into your vault.</NextStep>
        </ol>
      </div>

      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}

      <Footer>
        <Button
          variant="secondary"
          onClick={() => onEdit(1)}
          disabled={isSending}
        >
          Back
        </Button>
        <Button onClick={create} loading={isSending}>
          Create vault
        </Button>
      </Footer>
    </>
  );
}

function SummaryRow({
  label,
  onEdit,
  disabled,
  children,
}: {
  label: string;
  onEdit: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-small text-text-2">{label}</span>
        <div className="text-h3 font-semibold md:text-h3-lg">{children}</div>
      </div>
      <Button
        variant="link"
        onClick={onEdit}
        disabled={disabled}
        aria-label={`Edit ${label.toLowerCase()}`}
      >
        Edit
      </Button>
    </div>
  );
}

function NextStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="font-mono text-small text-text-3">{n}</span>
      <span>{children}</span>
    </li>
  );
}

// ---------- Created ----------

export function Created({
  waitUnits,
  guardian,
}: {
  waitUnits: number | null;
  guardian: Address;
}) {
  const navigate = useNavigate();
  return (
    <Column>
      <CircleCheck
        size={40}
        strokeWidth={1.5}
        className="text-stopped"
        aria-hidden
      />
      <Heading
        title="Your vault is ready."
        body={`Every withdrawal now waits ${waitUnits ? plural(waitUnits) : "the time you chose"}, and your guardian can stop it.`}
      />
      <Card className="flex flex-col gap-1">
        <span className="text-small text-text-2">Your guardian</span>
        <AddressText value={guardian} />
        <span className="text-small text-text-3">
          Let them know they're your guardian. They'll see waiting payments when
          they connect their wallet to Pause.
        </span>
      </Card>
      <Footer>
        <Button onClick={() => navigate("/vault")}>Go to your vault</Button>
      </Footer>
    </Column>
  );
}
