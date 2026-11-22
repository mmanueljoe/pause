import { createContext, useContext } from "react";

export const ConnectWalletContext = createContext<() => void>(() => {});

/** Opens the Connect wallet dialog (screen 2). */
export function useConnectWallet() {
  return useContext(ConnectWalletContext);
}
