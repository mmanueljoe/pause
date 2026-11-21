/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Solana RPC endpoint. Defaults to the public devnet URL when empty. */
  readonly VITE_SOLANA_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
