import { useWalletConnection } from "@solana/react-hooks";

export default function App() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  return (
    <div className="min-h-screen bg-bg1 text-foreground">
      <p className="border-b border-border-low px-6 py-2 text-center text-xs text-muted">
        Test network (devnet) only. Pause is an unaudited prototype: do not use
        real money.
      </p>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Pause</h1>
          <p className="text-base text-muted">
            Every withdrawal waits, so you or someone you trust can stop it.
          </p>
        </header>

        <section
          aria-labelledby="wallet-heading"
          className="space-y-4 rounded-xl border border-border-low bg-card p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="wallet-heading" className="text-lg font-semibold">
              Connect your wallet
            </h2>
            <span className="text-sm text-muted">
              {status === "connected" ? "Connected" : "Not connected"}
            </span>
          </div>

          {status === "connected" ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-lg bg-cream px-3 py-2 font-mono text-xs break-all">
                {address}
              </span>
              <button
                type="button"
                onClick={() => disconnect()}
                className="rounded-lg border border-border-low px-3 py-2 font-medium hover:bg-cream"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {connectors.length === 0 && (
                <p className="text-sm text-muted">
                  No wallet found. Install Phantom or Solflare, then reload this
                  page.
                </p>
              )}
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => connect(connector.id)}
                  disabled={status === "connecting"}
                  className="rounded-lg border border-border-low px-4 py-3 text-left font-medium hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "connecting" ? "Connecting…" : connector.name}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
