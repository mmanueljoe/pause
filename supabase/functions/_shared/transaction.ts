/**
 * Builds and signs the one transaction the backend sends: release_withdrawal
 * (US-9, FR-12). Hand-written because the Solana SDK is too large for
 * Supabase's bundler. Pure apart from WebCrypto, so Node can test it.
 *
 * The program lets anyone release a withdrawal once its wait has ended, and
 * only ever pays the named recipient, so the backend's wallet needs no power
 * over any vault: it just pays the network fee (a fraction of a cent).
 */
import { decodeBase58, encodeBase58 } from "./base58.ts";

export const PAUSE_PROGRAM = "BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz";
/** PDA of ["__event_authority"] for the Pause program (Anchor emit_cpi!). */
export const EVENT_AUTHORITY = "5mjAYdpJheomnPYT9fwgSTSAkKgf2AAgWjmd79A5pwJp";
/** release_withdrawal discriminator (anchor/target/idl/pause.json). */
const RELEASE_DISCRIMINATOR = [165, 252, 155, 233, 0, 47, 81, 143];

/** Solana's "compact-u16" length prefix. */
function compactU16(n: number): number[] {
  const out: number[] = [];
  let value = n;
  for (;;) {
    const byte = value & 0x7f;
    value >>= 7;
    if (value === 0) {
      out.push(byte);
      return out;
    }
    out.push(byte | 0x80);
  }
}

/**
 * A legacy transaction message with one instruction. Account order:
 * payer (signer, writable), vault, withdrawal, recipient (writable),
 * event authority, program (read-only).
 */
export function releaseMessage(input: {
  payer: string;
  vault: string;
  withdrawal: string;
  recipient: string;
  recentBlockhash: string;
}): Uint8Array {
  const keys = [
    input.payer,
    input.vault,
    input.withdrawal,
    input.recipient,
    EVENT_AUTHORITY,
    PAUSE_PROGRAM,
  ];
  if (new Set(keys).size !== keys.length)
    throw new Error("Release accounts must all be different");
  const key = (address: string) => {
    const bytes = decodeBase58(address);
    if (bytes.length !== 32) throw new Error(`Bad address ${address}`);
    return [...bytes];
  };
  const blockhash = decodeBase58(input.recentBlockhash);
  if (blockhash.length !== 32) throw new Error("Bad blockhash");
  return new Uint8Array([
    // Header: 1 signature, 0 read-only signers, 2 read-only non-signers.
    1,
    0,
    2,
    ...compactU16(keys.length),
    ...keys.flatMap(key),
    ...blockhash,
    ...compactU16(1), // one instruction
    5, // program id index (PAUSE_PROGRAM)
    ...compactU16(5),
    1,
    2,
    3,
    4,
    5, // vault, withdrawal, recipient, event authority, program
    ...compactU16(RELEASE_DISCRIMINATOR.length),
    ...RELEASE_DISCRIMINATOR,
  ]);
}

export type Signer = { address: string; privateKey: CryptoKey };

/** An Ed25519 key from a 32-byte seed (what a Solana keypair is). */
export async function signerFromSeed(seed: Uint8Array): Promise<Signer> {
  if (seed.length !== 32) throw new Error("Seed must be 32 bytes");
  // PKCS#8 wrapper for a raw Ed25519 private key (RFC 8410).
  // prettier-ignore
  const pkcs8 = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
    ...seed,
  ]);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "Ed25519" },
    true,
    ["sign"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  if (!jwk.x) throw new Error("Couldn't derive the public key");
  const publicKey = Uint8Array.from(
    atob(jwk.x.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0)
  );
  return { address: encodeBase58(publicKey), privateKey };
}

/** Signs a message; returns the wire transaction, base64-encoded. */
export async function signTransaction(
  message: Uint8Array,
  signer: Signer
): Promise<string> {
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, signer.privateKey, message)
  );
  const wire = new Uint8Array([...compactU16(1), ...signature, ...message]);
  let binary = "";
  for (const b of wire) binary += String.fromCharCode(b);
  return btoa(binary);
}
