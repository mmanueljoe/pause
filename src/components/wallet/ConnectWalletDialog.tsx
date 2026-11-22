import { useEffect, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, X } from "lucide-react";
import {
  useConnect,
  useConnectedWallet,
  useIsWalletReady,
  useWallets,
} from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";

import phantomIcon from "../../assets/wallets/phantom.svg";
import solflareIcon from "../../assets/wallets/solflare.svg";
import type { AppClient } from "../../lib/solana/client";
import { cx } from "../ui/cx";

/** Wallets we always list, even when not installed (with a Get link). */
const KNOWN_WALLETS = [
  {
    name: "Phantom",
    icon: phantomIcon,
    getUrl: "https://phantom.com/download",
    // Opens this page inside the Phantom app's browser, where the wallet works.
    openInApp: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`,
  },
  {
    name: "Solflare",
    icon: solflareIcon,
    getUrl: "https://solflare.com/download",
    openInApp: (url: string) =>
      `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`,
  },
] as const;

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Screen 2: Connect wallet. Modal on laptop, sheet on phone. Uses the native
 * <dialog> for focus trapping, Esc to close and returning focus afterwards.
 */
export function ConnectWalletDialog({ onClose }: { onClose: () => void }) {
  const client = useClient<AppClient>();
  const ready = useIsWalletReady(client);
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const { dispatch: connect, isRunning, error } = useConnect(client);
  const [chosen, setChosen] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open as a modal on mount. No close() in cleanup: closing fires the
  // dialog's "close" event, which would unmount it straight away (React runs
  // effects twice in development). Unmounting removes the dialog anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Close once a wallet is connected.
  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  const installedNames = new Set(wallets.map((w) => w.name));
  const others = wallets.filter(
    (w) => !KNOWN_WALLETS.some((k) => k.name === w.name)
  );
  const noneInstalled = wallets.length === 0;
  const phoneWithoutWallet = ready && noneInstalled && isPhone();

  function choose(name: string) {
    const wallet = wallets.find((w) => w.name === name);
    if (!wallet) return;
    setChosen(name);
    connect(wallet);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="connect-title"
      className={cx(
        "m-0 w-full max-w-none bg-transparent p-0 text-text backdrop:bg-bg/80",
        "fixed inset-x-0 top-auto bottom-0",
        "md:inset-0 md:m-auto md:h-fit md:max-w-[440px]"
      )}
    >
      <div className="flex flex-col gap-4 rounded-t-card border border-line bg-surface-1 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-card md:pb-6">
        <div className="flex items-start gap-4">
          <h2
            id="connect-title"
            className="flex-1 text-h3 font-semibold md:text-h3-lg"
          >
            Connect your wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring -m-3 inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:text-text"
            aria-label="Close"
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <p className="text-small text-text-2">
          {phoneWithoutWallet
            ? "On a phone, Pause works inside your wallet app. Open it there, then connect."
            : "Pause only sees your wallet's address. Nothing leaves your wallet unless you approve it there."}
        </p>

        {!ready ? (
          <p
            className="flex items-center gap-2 py-4 text-small text-text-2"
            role="status"
          >
            <LoaderCircle
              size={20}
              strokeWidth={1.5}
              className="animate-spin"
              aria-hidden
            />
            Looking for wallets…
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {KNOWN_WALLETS.map((known) => {
              const installed = installedNames.has(known.name);
              const wallet = wallets.find((w) => w.name === known.name);
              const connecting = isRunning && chosen === known.name;
              if (installed && wallet) {
                return (
                  <li key={known.name}>
                    <WalletRow
                      icon={wallet.icon}
                      name={known.name}
                      onClick={() => choose(known.name)}
                      disabled={isRunning}
                      right={connecting ? <Connecting /> : "Installed"}
                    />
                  </li>
                );
              }
              const href = phoneWithoutWallet
                ? known.openInApp(window.location.href)
                : known.getUrl;
              return (
                <li key={known.name}>
                  <WalletRow
                    icon={known.icon}
                    name={known.name}
                    href={href}
                    right={
                      <span className="flex items-center gap-1 text-text">
                        {phoneWithoutWallet ? "Open" : "Get"}
                        <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                    }
                  />
                </li>
              );
            })}
            {others.map((wallet) => (
              <li key={wallet.name}>
                <WalletRow
                  icon={wallet.icon}
                  name={wallet.name}
                  onClick={() => choose(wallet.name)}
                  disabled={isRunning}
                  right={
                    isRunning && chosen === wallet.name ? (
                      <Connecting />
                    ) : (
                      "Installed"
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {isRunning && chosen && (
          <p className="text-small text-text-2" role="status">
            Approve the connection in {chosen}.
          </p>
        )}
        {!isRunning && error != null && chosen && (
          <p className="text-small text-error" role="alert">
            {describeConnectError(chosen, error)}
          </p>
        )}

        <p className="flex flex-wrap items-center gap-1 text-small text-text-2">
          Don't have one?
          <a
            href={KNOWN_WALLETS[0].getUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring rounded text-body text-text underline-offset-4 hover:underline"
          >
            Get Phantom
          </a>
        </p>
      </div>
    </dialog>
  );
}

function WalletRow({
  icon,
  name,
  right,
  onClick,
  href,
  disabled,
}: {
  icon: string;
  name: string;
  right: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "focus-ring flex w-full items-center gap-3 rounded-input border border-line bg-surface-2 p-4 text-left transition-colors hover:border-text-3 disabled:cursor-wait";
  const content = (
    <>
      <img src={icon} alt="" className="size-8 rounded-lg" />
      <span className="flex-1 text-body">{name}</span>
      <span className="text-small whitespace-nowrap text-text-2">{right}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {content}
    </button>
  );
}

function Connecting() {
  return (
    <span className="flex items-center gap-2">
      <LoaderCircle
        size={16}
        strokeWidth={1.5}
        className="animate-spin"
        aria-hidden
      />
      Connecting…
    </span>
  );
}

/** Says what actually went wrong (this screen sends no money). */
function describeConnectError(walletName: string, error: unknown): string {
  const text = error instanceof Error ? error.message.toLowerCase() : "";
  if (/reject|denied|declined|cancel/.test(text)) {
    return `You closed ${walletName} before connecting. Try again when you're ready.`;
  }
  if (/lock/.test(text))
    return `${walletName} is locked. Unlock it, then try again.`;
  return `${walletName} didn't connect. Open ${walletName}, check it's on devnet, then try again.`;
}
