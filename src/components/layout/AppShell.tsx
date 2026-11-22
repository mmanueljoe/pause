import { Link, Outlet } from "react-router";

import { DemoLabel, Logo } from "../ui";
import { AccountMenu } from "./AccountMenu";

/** Top bar (logo, demo label, wallet) + page + footer, on every screen. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 py-6 md:px-8 xl:px-0">
        <Link to="/" className="focus-ring shrink-0 rounded">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-flex">
            <DemoLabel />
          </span>
          <AccountMenu />
        </div>
      </header>
      <div className="flex justify-center px-5 sm:hidden">
        <DemoLabel />
      </div>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 md:px-8 xl:px-0">
        <Outlet />
      </main>

      <footer className="mx-auto flex w-full max-w-[1120px] flex-wrap justify-between gap-2 border-t border-line px-5 py-8 font-mono text-label font-medium text-text-3 uppercase md:px-8 xl:px-0">
        <span>Solana devnet · Open source</span>
        <span>Unaudited prototype</span>
      </footer>
    </div>
  );
}
