import { Navigate } from "react-router";

import { useRole, useWalletAddress } from "../lib/pause/hooks";
import { Landing } from "./landing/Landing";

/**
 * "/": the landing page for visitors. Once a wallet is connected, sends each
 * person to the right home (FR-2): owner → vault, guardian → vaults they
 * protect, new user → create a vault.
 */
export function Home() {
  const wallet = useWalletAddress();
  const { role } = useRole(wallet);

  if (!wallet) return <Landing />;
  if (role === null) {
    return (
      <p className="text-center text-text-2" role="status">
        Checking your wallet…
      </p>
    );
  }
  if (role === "neither") return <Navigate to="/setup" replace />;
  if (role === "guardian") return <Navigate to="/guardian" replace />;
  return <Navigate to="/vault" replace />;
}
