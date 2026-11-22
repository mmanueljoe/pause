import { createBrowserRouter, RouterProvider } from "react-router";

import { AppShell } from "./components/layout/AppShell";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
import { Setup } from "./pages/setup/Setup";

/** One URL per screen (docs/requirements.md, Screens). */
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/setup", element: <Setup /> },
      {
        path: "/vault",
        element: <Placeholder screen={5} title="Your vault" />,
      },
      {
        path: "/vault/withdraw",
        element: <Placeholder screen={7} title="Withdraw" />,
      },
      {
        path: "/vaults/:vault/payments/:id",
        element: <Placeholder screen={8} title="Waiting payment" />,
      },
      {
        path: "/guardian",
        element: <Placeholder screen={10} title="Vaults you protect" />,
      },
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
