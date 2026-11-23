import { useState } from "react";
import { Link, useParams } from "react-router";
import { Check, CircleAlert, CircleCheck, Info, X } from "lucide-react";
import useSWR from "swr";

import { Button, Card, Input } from "../../components/ui";
import { useConnectWallet } from "../../components/wallet/connect-context";
import {
  BackendError,
  callFunction,
  type InviteInfo,
  useSignWalletMessage,
} from "../../lib/backend";
import { shortAddress } from "../../lib/pause/format";
import { useWalletAddress } from "../../lib/pause/hooks";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Screen 9: a guardian accepts their invite (FR-13, US-3). */
export function Invite() {
  const { code = "" } = useParams();
  const { data, error } = useSWR(["invite", code], () =>
    callFunction<InviteInfo>("get-invite", { code })
  );

  return (
    <div className="mx-auto max-w-[560px] py-12">
      <Card className="flex flex-col gap-6 p-8">
        {error ? (
          <Problem title="Couldn't open this invite.">
            {error instanceof BackendError
              ? error.message
              : "Try again in a moment."}
          </Problem>
        ) : !data ? (
          <p className="text-text-2" role="status">
            Opening your invite…
          </p>
        ) : (
          <InviteView code={code} invite={data} />
        )}
      </Card>
    </div>
  );
}

/** The invite, given its details. Split out so every state can be previewed. */
export function InviteView({
  code,
  invite,
}: {
  code: string;
  invite: InviteInfo;
}) {
  const owner = invite.ownerName ?? "The owner";
  if (invite.status === "invalid") {
    return (
      <Problem title="This invite link isn't valid.">
        Check you copied the whole link, or ask for a new one.
      </Problem>
    );
  }
  if (invite.status === "expired") {
    return (
      <Problem title="This invite has expired.">
        Invite links work for 7 days. Ask {owner} to send you a new one.
      </Problem>
    );
  }
  if (invite.status === "used") {
    return (
      <Problem title="This invite was already accepted.">
        If that was you, you're already {owner}'s guardian.{" "}
        <Link
          to="/guardian"
          className="focus-ring rounded text-text underline underline-offset-4"
        >
          See the vaults you protect
        </Link>
        .
      </Problem>
    );
  }
  return <OpenInvite code={code} invite={invite} owner={owner} />;
}

function OpenInvite({
  code,
  invite,
  owner,
}: {
  code: string;
  invite: InviteInfo;
  owner: string;
}) {
  const wallet = useWalletAddress();
  const openConnect = useConnectWallet();
  const { sign, isSigning } = useSignWalletMessage();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const expected = invite.guardian!;
  const rightWallet = wallet !== null && wallet === expected;
  const emailError =
    touched && email !== "" && !EMAIL.test(email.trim())
      ? "Enter a valid email address."
      : undefined;

  async function accept() {
    setError(null);
    setBusy(true);
    try {
      const signed = await sign("accept invite", invite.vault!, {
        Email: email.trim(),
      });
      await callFunction("accept-invite", { code, ...signed });
      setAccepted(true);
    } catch (e) {
      setError(
        e instanceof BackendError
          ? e.message
          : "Something went wrong. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (accepted) {
    return (
      <div className="flex flex-col gap-4">
        <CircleCheck
          size={40}
          strokeWidth={1.5}
          className="text-stopped"
          aria-hidden
        />
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          You're now {owner}'s guardian.
        </h1>
        <p className="text-text-2">
          If a payment from {owner}'s vault looks like theft, we'll email{" "}
          {email.trim()}. You can stop it from Pause before it leaves.
        </p>
        <Link
          to="/guardian"
          className="focus-ring inline-flex h-12 items-center justify-center self-start rounded-full bg-text px-6 text-bg hover:bg-released"
        >
          See the vaults you protect
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-h1 font-semibold md:text-h1-lg">
          {owner} asked you to be their guardian
        </h1>
        <p className="text-text-2">
          You'll see every payment that leaves {owner}'s vault, and get an
          urgent alert if one looks like theft. You can stop it. You can't spend{" "}
          {owner}'s money.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <List
          title="You can"
          can
          items={[
            "See every payment that leaves the vault",
            "Stop a payment",
            "Approve one early",
          ]}
        />
        <List
          title="You can't"
          items={[
            `Spend or move ${owner}'s money`,
            `Change ${owner}'s settings`,
          ]}
        />
      </div>

      <hr className="border-line" />

      <section className="flex flex-col gap-3" aria-labelledby="step-wallet">
        <h2 id="step-wallet" className="text-small text-text-2">
          1 · Connect your wallet
        </h2>
        <p>
          {owner} added the wallet{" "}
          <span className="font-mono text-small">{shortAddress(expected)}</span>
          .
        </p>
        {!wallet && (
          <Button fullWidth onClick={openConnect}>
            Connect wallet
          </Button>
        )}
        {wallet && rightWallet && (
          <p className="flex items-center gap-2 text-stopped">
            <Check size={20} strokeWidth={1.5} aria-hidden />
            That's the wallet you connected.
          </p>
        )}
        {wallet && !rightWallet && (
          <p className="flex items-start gap-2 text-error" role="alert">
            <CircleAlert
              size={20}
              strokeWidth={1.5}
              className="shrink-0"
              aria-hidden
            />
            <span>
              This isn't the wallet {owner} added. You connected{" "}
              <span className="font-mono text-small">
                {shortAddress(wallet)}
              </span>
              . Switch wallets, or ask {owner} to check the address.
            </span>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="step-email">
        <h2 id="step-email" className="text-small text-text-2">
          2 · Get alerts by email
        </h2>
        <Input
          label="Where should we send alerts?"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          error={emailError}
          help={`We only use it to alert you about ${owner}'s vault. It's stored by Pause and kept off Solana.`}
          disabled={!rightWallet || busy}
        />
      </section>

      <p className="flex items-start gap-2 text-small text-text-2">
        <Info size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
        Accepting asks you to sign a message in your wallet. It's free and moves
        no money.
      </p>
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <Button
        fullWidth
        onClick={accept}
        loading={busy && !isSigning}
        disabled={!rightWallet || !EMAIL.test(email.trim()) || busy}
      >
        {isSigning ? "Check your wallet…" : "Accept and turn on alerts"}
      </Button>
    </>
  );
}

function List({
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
    <div className="flex flex-col gap-2">
      <p className="text-small text-text-2">{title}</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon
              size={18}
              strokeWidth={1.5}
              className={
                can ? "mt-0.5 shrink-0" : "mt-0.5 shrink-0 text-text-3"
              }
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Problem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-h2 font-semibold md:text-h2-lg">{title}</h1>
      <p className="text-text-2">{children}</p>
    </div>
  );
}
