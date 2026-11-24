/**
 * The message a wallet signs to prove "this request really comes from me".
 * Shared by the website (to build it) and Edge Functions (to check it), so
 * the two can never disagree. Signing is free: nothing is sent on Solana.
 *
 * Anything being saved goes in the message as a detail line, so the wallet
 * shows exactly what the person approves, and nobody can swap it in transit.
 *
 * Example:
 *   Pause: save guardian details
 *   Vault: 8DbHNX3HGXnPpG9YP9BN8EeLMPgxepaPpXBBXPNXotpY
 *   Wallet: 6j7brYcn8TJuHtczirfdLLs4BizzCWbxpVtdXivCBzpv
 *   Issued: 2026-11-23T16:00:00.000Z
 *   Your name: Ama
 *   Guardian name: Kofi
 */

export type WalletAction =
  | "save guardian details"
  | "accept invite"
  | "save my email"
  | "stop emailing me";

/** Detail lines each action may carry, in this order. */
export const ACTION_DETAILS: Record<WalletAction, readonly string[]> = {
  "save guardian details": ["Your name", "Guardian name", "Time zone"],
  "accept invite": ["Email"],
  "save my email": ["Email"],
  "stop emailing me": [],
};

/** How long a signed message stays valid. */
export const MESSAGE_MAX_AGE_MS = 5 * 60_000;

export type WalletMessage = {
  action: WalletAction;
  vault: string;
  wallet: string;
  issued: Date;
  details: Record<string, string>;
};

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Detail values: one line, no control characters, at most 120 characters. */
const VALUE = /^[^\p{Cc}]{1,120}$/u;

export function buildWalletMessage(m: WalletMessage): string {
  const lines = [
    `Pause: ${m.action}`,
    `Vault: ${m.vault}`,
    `Wallet: ${m.wallet}`,
    `Issued: ${m.issued.toISOString()}`,
  ];
  for (const key of ACTION_DETAILS[m.action]) {
    const value = m.details[key];
    if (value === undefined || !VALUE.test(value)) {
      throw new Error(`Missing or invalid "${key}"`);
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}

/** Reads a message back. Returns null if it isn't exactly in our format. */
export function parseWalletMessage(text: string): WalletMessage | null {
  const lines = text.split("\n");
  const take = (prefix: string, i: number) =>
    lines[i]?.startsWith(prefix) ? lines[i].slice(prefix.length) : null;

  const action = take("Pause: ", 0) as WalletAction | null;
  if (!action || !(action in ACTION_DETAILS)) return null;
  const vault = take("Vault: ", 1);
  const wallet = take("Wallet: ", 2);
  const issuedText = take("Issued: ", 3);
  if (!vault || !wallet || !issuedText) return null;
  if (!ADDRESS.test(vault) || !ADDRESS.test(wallet)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(issuedText)) {
    return null;
  }
  const issued = new Date(issuedText);
  if (Number.isNaN(issued.getTime())) return null;

  const keys = ACTION_DETAILS[action];
  if (lines.length !== 4 + keys.length) return null;
  const details: Record<string, string> = {};
  for (const [i, key] of keys.entries()) {
    const value = take(`${key}: `, 4 + i);
    if (value === null || !VALUE.test(value)) return null;
    details[key] = value;
  }
  return { action, vault, wallet, issued, details };
}
