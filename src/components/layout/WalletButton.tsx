import { useState } from "react";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
  WalletReadyGate,
} from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";

import { shortAddress } from "../../lib/pause/format";
import type { AppClient } from "../../lib/solana/client";
import { Button } from "../ui";

/**
 * Basic connect / disconnect. The designed Connect wallet screen (screen 2)
 * replaces the picker in W2.
 */
export function WalletButton() {
  const client = useClient<AppClient>();
  return (
    <WalletReadyGate
      client={client}
      fallback={
        <Button variant="secondary" disabled>
          Connect wallet
        </Button>
      }
    >
      <WalletButtonInner client={client} />
    </WalletReadyGate>
  );
}

function WalletButtonInner({ client }: { client: AppClient }) {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const { dispatch: connect, isRunning: connecting } = useConnect(client);
  const { dispatch: disconnect } = useDisconnect(client);
  const [open, setOpen] = useState(false);

  if (connected) {
    return (
      <Button
        variant="secondary"
        onClick={() => disconnect()}
        title="Disconnect"
      >
        <span className="font-mono text-small">
          {shortAddress(connected.account.address)}
        </span>
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setOpen((o) => !o)}
        loading={connecting}
        aria-expanded={open}
      >
        Connect wallet
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 flex w-64 flex-col gap-1 rounded-card border border-line bg-surface-1 p-2">
          {wallets.length === 0 && (
            <p className="p-3 text-small text-text-2">
              No wallet found. Install Phantom or Solflare, then reload this
              page.
            </p>
          )}
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              type="button"
              onClick={() => {
                setOpen(false);
                connect(wallet);
              }}
              className="focus-ring flex items-center gap-3 rounded-input p-3 text-left hover:bg-surface-2"
            >
              <img src={wallet.icon} alt="" className="size-6 rounded" />
              {wallet.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
