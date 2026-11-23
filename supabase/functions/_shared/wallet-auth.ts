import {
  address,
  getBase64Encoder,
  getPublicKeyFromAddress,
  type SignatureBytes,
  verifySignature,
} from "@solana/kit";

import {
  MESSAGE_MAX_AGE_MS,
  parseWalletMessage,
  type WalletAction,
  type WalletMessage,
} from "./message.ts";

export class AuthError extends Error {}

/**
 * Checks a wallet-signed request: the message is in our format, for this
 * action, recent (5 minutes), and really signed by the wallet it names.
 * Replay protection (each signature used once) is done by the caller in the
 * database, so it holds across function instances.
 */
export async function verifyWalletMessage(input: {
  message: string;
  /** Base64 ed25519 signature over the UTF-8 message. */
  signature: string;
  action: WalletAction;
  now?: Date;
}): Promise<WalletMessage> {
  const parsed = parseWalletMessage(input.message);
  if (!parsed)
    throw new AuthError("The signed message isn't in Pause's format.");
  if (parsed.action !== input.action)
    throw new AuthError("The signed message is for a different action.");

  const now = (input.now ?? new Date()).getTime();
  const age = now - parsed.issued.getTime();
  if (age > MESSAGE_MAX_AGE_MS)
    throw new AuthError("The signed message is too old. Try again.");
  if (age < -60_000)
    throw new AuthError(
      "The signed message is dated in the future. Check your clock."
    );

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = getBase64Encoder().encode(input.signature) as Uint8Array;
  } catch {
    throw new AuthError("The signature isn't valid.");
  }
  if (signatureBytes.length !== 64)
    throw new AuthError("The signature isn't valid.");

  const publicKey = await getPublicKeyFromAddress(address(parsed.wallet));
  const ok = await verifySignature(
    publicKey,
    signatureBytes as SignatureBytes,
    new TextEncoder().encode(input.message)
  );
  if (!ok) throw new AuthError("The signature doesn't match the wallet.");
  return parsed;
}
