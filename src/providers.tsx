import { type PropsWithChildren } from "react";
import { ClientProvider } from "@solana/react";

import { ToastProvider } from "./components/ui";
import { client } from "./lib/solana/client";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </ClientProvider>
  );
}
