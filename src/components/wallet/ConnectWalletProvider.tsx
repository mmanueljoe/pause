import { type ReactNode, useCallback, useState } from "react";

import { ConnectWalletContext } from "./connect-context";
import { ConnectWalletDialog } from "./ConnectWalletDialog";

/** Lets any button open the Connect wallet dialog via `useConnectWallet()`. */
export function ConnectWalletProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return (
    <ConnectWalletContext.Provider value={show}>
      {children}
      {open && <ConnectWalletDialog onClose={() => setOpen(false)} />}
    </ConnectWalletContext.Provider>
  );
}
