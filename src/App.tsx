import { createBrowserRouter, RouterProvider } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { GuardianHome } from "./pages/guardian/GuardianHome";
import { History } from "./pages/history/History";
import { Home } from "./pages/Home";
import { Invite } from "./pages/invite/Invite";
import { NotFound } from "./pages/NotFound";
import { Settings } from "./pages/settings/Settings";
import { Setup } from "./pages/setup/Setup";
import { PaymentDetail } from "./pages/payment/PaymentDetail";
import { VaultHome } from "./pages/vault/VaultHome";
import { Withdraw } from "./pages/vault/Withdraw";

/** One URL per screen (docs/requirements.md, Screens). */
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/setup", element: <Setup /> },
      { path: "/vault", element: <VaultHome /> },
      { path: "/vault/withdraw", element: <Withdraw /> },
      { path: "/vaults/:vault/payments/:id", element: <PaymentDetail /> },
      { path: "/guardian", element: <GuardianHome /> },
      { path: "/invite/:code", element: <Invite /> },
      { path: "/settings", element: <Settings /> },
      { path: "/history", element: <History /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
