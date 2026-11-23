/**
 * The message a wallet signs to prove "this request really comes from me".
 * Shared by the website (to build it) and Edge Functions (to check it), so
 * the two can never disagree. Signing is free: nothing is sent on Solana.
 *
 * Example:
 *   Pause: save guardian details
 *   Vault: 8DbHNX3HGXnPpG9YP9BN8EeLMPgxepaPpXBBXPNXotpY
 *   Wallet: 6j7brYcn8TJuHtczirfdLLs4BizzCWbxpVtdXivCBzpv
 *   Issued: 2026-11-23T16:00:00.000Z
 */

export type WalletAction =
  "save guardian details" | "accept invite" | "save my email";

/** How long a signed message stays valid. */
export const MESSAGE_MAX_AGE_MS = 5 * 60_000;

export type WalletMessage = {
  action: WalletAction;
  vault: string;
  wallet: string;
  issued: Date;
};

export function buildWalletMessage(m: WalletMessage): string {
  return [
    `Pause: ${m.action}`,
    `Vault: ${m.vault}`,
    `Wallet: ${m.wallet}`,
    `Issued: ${m.issued.toISOString()}`,
  ].join("\n");
}

/** Reads a message back. Returns null if it isn't exactly in our format. */
export function parseWalletMessage(text: string): WalletMessage | null {
  const match = text.match(
    /^Pause: (save guardian details|accept invite|save my email)\nVault: ([1-9A-HJ-NP-Za-km-z]{32,44})\nWallet: ([1-9A-HJ-NP-Za-km-z]{32,44})\nIssued: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/
  );
  if (!match) return null;
  const issued = new Date(match[4]);
  if (Number.isNaN(issued.getTime())) return null;
  return {
    action: match[1] as WalletAction,
    vault: match[2],
    wallet: match[3],
    issued,
  };
}
