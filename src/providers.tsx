import { type PropsWithChildren } from "react";
import { ClientProvider } from "@solana/react";

import { ToastProvider } from "./components/ui";
import { ConnectWalletProvider } from "./components/wallet/ConnectWalletProvider";
import { client } from "./lib/solana/client";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ClientProvider client={client}>
      <ToastProvider>
        <ConnectWalletProvider>{children}</ConnectWalletProvider>
      </ToastProvider>
    </ClientProvider>
  );
}
