import { type ReactNode, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  Address,
  Button,
  Card,
  Countdown,
  NewAddressTag,
  StatusLabel,
} from "../../components/ui";
import { buttonClasses } from "../../components/ui/button-classes";
import { cx } from "../../components/ui/cx";
import { useConnectWallet } from "../../components/wallet/connect-context";
import { formatTime } from "../../lib/pause/format";

// Example addresses for the illustrations (not real wallets).
const THIEF = "7xKpQm4hW2nR8vBtYcJfLd3sZe6uGa9pXk1oNq5ra91Q";
const OLD_WALLET = "2r1MvH8sKd4qTzPa7nYcWbE3fLg5jRu9xN6oQiStyNVy";
const NEW_WALLET = "9fQeT2xVb7nKm4pWcZr8sJd1hYgLa6uE3oNqRiXtLm3T";

/** Screen 1: Landing (marketing register). Copy from Figma "01 Landing". */
export function Landing() {
  const connect = useConnectWallet();
  return (
    <>
      {/* Hero */}
      <section className="flex flex-col items-center gap-12 py-12 md:py-24 lg:flex-row lg:gap-16">
        <div className="flex flex-1 flex-col items-start gap-6">
          <h1 className="text-display font-semibold md:text-display-lg">
            What you save.
            <br />
            Stays yours.
          </h1>
          <p className="max-w-[616px] text-text-2">
            A stolen recovery phrase shouldn't cost you your savings. Pause is a
            vault on Solana that makes every withdrawal wait, so someone you
            trust can stop a theft before it leaves.
          </p>
          <Button size="large" onClick={connect}>
            Connect wallet
          </Button>
        </div>
        <WaitingPaymentPreview />
      </section>

      {/* The four mechanisms */}
      <section
        className="flex flex-col gap-12 pb-24"
        aria-labelledby="mechanics-title"
      >
        <div className="flex max-w-[640px] flex-col gap-4">
          <h2
            id="mechanics-title"
            className="text-h1 font-semibold md:text-h1-lg"
          >
            Time-locked. Guardian-checked.
          </h2>
          <p className="text-text-2">
            Your savings sit in a vault, apart from your wallet. Every
            withdrawal waits the time you set. Your guardian can stop it, and
            can't spend it.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[696fr_400fr]">
          <Mechanism
            title="Time-locked withdrawals"
            body="Every withdrawal waits the time you choose, from 1 hour to 7 days, including one made with stolen keys."
          >
            <DemoCountdown />
          </Mechanism>
          <Mechanism
            title="Guardian veto"
            body="Someone you trust can stop a payment or approve one early. They can't spend your money."
          >
            <div className="flex flex-col gap-2" aria-hidden>
              <span className={cx(buttonClasses("stop"), "w-full")}>
                Stop this payment
              </span>
              <span className={cx(buttonClasses("approve"), "w-full")}>
                Approve now
              </span>
            </div>
          </Mechanism>
        </div>
        <div className="grid gap-6 md:grid-cols-[400fr_696fr]">
          <Mechanism
            title="Theft alerts"
            body="Your guardian gets an urgent alert when a withdrawal looks like theft: a new address, most of your savings, or late at night."
          >
            <div className="flex flex-col items-start gap-2 rounded-input border border-line bg-surface-2 p-4">
              <NewAddressTag />
              <p>Ama is sending 12 SOL to a new address. Was this her?</p>
            </div>
          </Mechanism>
          <Mechanism
            title="Rescue"
            body="Lost your recovery phrase? Your guardian approves moving everything to your new wallet, and it arrives at once."
          >
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 flex-col items-start gap-1 rounded-input bg-surface-2 p-4">
                <span className="text-small text-text-2">Old wallet</span>
                <Address value={OLD_WALLET} />
                <span className="text-small text-text-3">
                  The thief has this key
                </span>
              </div>
              <ChevronRight
                size={20}
                strokeWidth={1.5}
                className="shrink-0 self-center text-text-2 max-sm:rotate-90"
                aria-hidden
              />
              <div className="flex flex-1 flex-col items-start gap-1 rounded-input bg-surface-2 p-4">
                <span className="text-small text-text-2">New wallet</span>
                <Address value={NEW_WALLET} />
                <StatusLabel status="arrived">Arrived</StatusLabel>
              </div>
            </div>
          </Mechanism>
        </div>

        <p className="text-small text-text-3">
          Pause stops a theft before the money leaves. It can't get back money
          that's already gone.
        </p>
      </section>

      {/* Closing */}
      <section className="flex flex-col items-center gap-8 border-t border-line py-24 text-center">
        <h2 className="text-h1 font-semibold md:text-h1-lg">
          Save like someone's watching.
        </h2>
        <Button size="large" onClick={connect}>
          Connect wallet
        </Button>
      </section>
    </>
  );
}

function Mechanism({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col justify-between gap-8 p-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-h3 font-semibold md:text-h3-lg">{title}</h3>
        <p className="text-text-2">{body}</p>
      </div>
      {children}
    </Card>
  );
}

/**
 * A live example countdown (6-hour wait, 5:42:10 left when the page opens).
 * The bar really drains, so visitors see the product, not a picture of it.
 */
function DemoCountdown() {
  const [times] = useState(() => {
    const total = 6 * 3600 * 1000;
    const left = (5 * 3600 + 42 * 60 + 10) * 1000;
    const endsAt = new Date(Date.now() + left);
    return { startedAt: new Date(endsAt.getTime() - total), endsAt };
  });
  return <Countdown startedAt={times.startedAt} endsAt={times.endsAt} />;
}

/** Hero illustration: the guardian's view of a paused theft. Not interactive. */
function WaitingPaymentPreview() {
  const [arrives] = useState(
    () => new Date(Date.now() + (5 * 3600 + 42 * 60 + 10) * 1000)
  );
  return (
    <figure
      className="flex w-full flex-col gap-6 rounded-card border border-line bg-surface-1 p-6 lg:w-[440px] lg:shrink-0"
      aria-label="Example: Kofi, a guardian, sees Ama's vault sending 12 SOL to a new address and can stop it."
    >
      <span className="self-start">
        <StatusLabel status="waiting">{`Paused · arrives ${formatTime(arrives)}`}</StatusLabel>
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-h3 font-semibold md:text-h3-lg">
          Ama is sending 12 SOL to a new address.
        </p>
        <p className="flex items-center gap-2 text-small text-text-2">
          to <Address value={THIEF} />
        </p>
        <p className="text-text-2">Was this her?</p>
      </div>
      <DemoCountdown />
      <div className="flex flex-col gap-3 sm:flex-row" aria-hidden>
        <span
          className={cx(
            buttonClasses("stop", "large"),
            "order-first sm:order-last sm:flex-1"
          )}
        >
          Stop this payment
        </span>
        <span className={buttonClasses("approve", "large")}>Approve now</span>
      </div>
    </figure>
  );
}
