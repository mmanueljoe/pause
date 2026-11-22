import { Link, Outlet } from "react-router";

import { DemoLabel, Logo } from "../ui";
import { WalletButton } from "./WalletButton";

/** Header (logo, demo label, wallet) + page + honest footer, on every screen. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="focus-ring rounded">
            <Logo />
          </Link>
          <DemoLabel />
        </div>
        <WalletButton />
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 py-8 md:px-0 md:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line px-5 py-6 text-center text-small text-text-3">
        Pause is an unaudited prototype on Solana's test network (devnet). Do
        not use real money.
      </footer>
    </div>
  );
}
