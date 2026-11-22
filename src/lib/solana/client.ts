import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";

/** Pause runs on devnet only (see docs/requirements.md, Non-functional requirements). */
export const CLUSTER = "devnet" as const;

const DEVNET_RPC_URL = "https://api.devnet.solana.com";

/**
 * One Solana client for the whole app.
 * - `walletSigner`: finds Wallet Standard wallets (Phantom, Solflare); the
 *   connected wallet pays fees and signs.
 * - `solanaRpc`: talks to Solana and plans, signs and sends transactions.
 *
 * Transactions use version 0: every Pause instruction is small, and all
 * current wallets can sign v0. (Version 1 adds nothing we need yet.)
 */
export const client = createClient()
  .use(walletSigner({ chain: `solana:${CLUSTER}` }))
  .use(
    solanaRpc({
      rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || DEVNET_RPC_URL,
      transactionConfig: { version: 0 },
    })
  );

export type AppClient = Awaited<typeof client>;
