import { decodeBase64, encodeBase58 } from "./base58.ts";

/** Pause program on devnet (anchor/programs/pause/src/lib.rs, declare_id!). */
export const PAUSE_PROGRAM_ADDRESS =
  "BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz";

/** First 8 bytes of every Vault account (Anchor discriminator). */
const VAULT_DISCRIMINATOR = [211, 8, 232, 43, 2, 152, 117, 119];

export function rpcUrl(): string {
  return Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error)
    throw new Error(`Solana RPC ${method}: ${body.error.message}`);
  return body.result as T;
}

export type VaultInfo = { owner: string; guardian: string | null };

/**
 * Reads who owns and guards a vault, straight from Solana. On-chain data is
 * untrusted: checks the account belongs to Pause and is a Vault first.
 * Layout: discriminator (8) · owner (32) · guardian Option (1 + 32).
 */
export async function readVault(vault: string): Promise<VaultInfo | null> {
  const result = await rpc<{
    value: { owner: string; data: [string, string] } | null;
  }>("getAccountInfo", [
    vault,
    { encoding: "base64", commitment: "confirmed" },
  ]);
  const account = result.value;
  if (!account || account.owner !== PAUSE_PROGRAM_ADDRESS) return null;
  const bytes = decodeBase64(account.data[0]);
  if (bytes.length < 73 || !VAULT_DISCRIMINATOR.every((b, i) => bytes[i] === b))
    return null;
  const owner = encodeBase58(bytes.slice(8, 40));
  const guardian = bytes[40] === 1 ? encodeBase58(bytes.slice(41, 73)) : null;
  return { owner, guardian };
}
