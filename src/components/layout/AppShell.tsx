import { Link, NavLink, Outlet } from "react-router";

import {
  useGuardedVaults,
  useVault,
  useVaultAddress,
  useWalletAddress,
} from "../../lib/pause/hooks";
import { DemoLabel, Logo } from "../ui";
import { cx } from "../ui/cx";
import { AccountMenu } from "./AccountMenu";

/** Top bar (logo, owner nav, demo label, wallet) + page + footer. */
export function AppShell() {
  const wallet = useWalletAddress();
  const { vault } = useVault(useVaultAddress(wallet));
  const { vaults: guarded } = useGuardedVaults(wallet);
  const isOwner = vault !== null;
  const isGuardian = guarded.length > 0;
  const showNav = isOwner || isGuardian;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 py-6 md:px-8 xl:px-0">
        <div className="flex items-center gap-10">
          <Link to="/" className="focus-ring shrink-0 rounded">
            <Logo />
          </Link>
          {showNav && (
            <Nav
              isOwner={isOwner}
              isGuardian={isGuardian}
              className="hidden md:flex"
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-flex">
            <DemoLabel />
          </span>
          <AccountMenu />
        </div>
      </header>
      <div className="flex flex-col items-center gap-4 px-5 sm:hidden">
        <DemoLabel />
      </div>
      {showNav && (
        <Nav
          isOwner={isOwner}
          isGuardian={isGuardian}
          className="mx-5 flex justify-center md:hidden"
        />
      )}

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

/** Owner: Vault · History · Settings. Guardian: Vaults · History. Both: all. */
function Nav({
  isOwner,
  isGuardian,
  className,
}: {
  isOwner: boolean;
  isGuardian: boolean;
  className?: string;
}) {
  const item = ({ isActive }: { isActive: boolean }) =>
    cx(
      "focus-ring flex min-h-11 items-center rounded text-small whitespace-nowrap",
      isActive ? "text-text" : "text-text-2 hover:text-text"
    );
  return (
    <nav aria-label="Main" className={cx("items-center gap-6", className)}>
      {isOwner && (
        <NavLink to="/vault" end className={item}>
          Vault
        </NavLink>
      )}
      {isGuardian && (
        <NavLink to="/guardian" className={item}>
          {isOwner ? "Vaults you protect" : "Vaults"}
        </NavLink>
      )}
      <NavLink to="/history" className={item}>
        History
      </NavLink>
      {isOwner && (
        <NavLink to="/settings" className={item}>
          Settings
        </NavLink>
      )}
    </nav>
  );
}
