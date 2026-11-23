import { createBrowserRouter, RouterProvider } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { GuardianHome } from "./pages/guardian/GuardianHome";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
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
      {
        path: "/invite/:code",
        element: <Placeholder screen={9} title="Guardian invite" />,
      },
      {
        path: "/settings",
        element: <Placeholder screen={11} title="Settings" />,
      },
      {
        path: "/history",
        element: <Placeholder screen={12} title="History" />,
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
