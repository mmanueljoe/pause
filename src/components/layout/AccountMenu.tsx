import { useEffect, useRef, useState } from "react";
import {
  useConnectedWallet,
  useDisconnect,
} from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";

import { shortAddress } from "../../lib/pause/format";
import type { AppClient } from "../../lib/solana/client";
import { Button } from "../ui";
import { useConnectWallet } from "../wallet/connect-context";

/** Header wallet control: Connect wallet, or the short address with a menu. */
export function AccountMenu() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const { dispatch: disconnect } = useDisconnect(client);
  const openConnect = useConnectWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!connected) return <Button onClick={openConnect}>Connect wallet</Button>;

  const address = connected.account.address;
  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <img src={connected.wallet.icon} alt="" className="size-5 rounded" />
        <span className="font-mono text-small">{shortAddress(address)}</span>
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 flex w-52 flex-col rounded-card border border-line bg-surface-1 p-2"
        >
          <button
            role="menuitem"
            type="button"
            className="focus-ring rounded-input p-3 text-left text-small hover:bg-surface-2"
            onClick={() => {
              void navigator.clipboard?.writeText(address);
              setOpen(false);
            }}
          >
            Copy address
          </button>
          <button
            role="menuitem"
            type="button"
            className="focus-ring rounded-input p-3 text-left text-small hover:bg-surface-2"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
