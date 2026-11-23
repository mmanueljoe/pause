/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Solana RPC endpoint. Defaults to the public devnet URL when empty. */
  readonly VITE_SOLANA_RPC_URL?: string;
  /** Supabase project URL (public). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key (public; functions check wallet signatures). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
