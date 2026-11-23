/**
 * Base58 (Solana addresses and signatures), without dependencies: the full
 * Solana SDK is too large for Supabase's function bundler.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function decodeBase58(text: string): Uint8Array {
  let value = 0n;
  for (const char of text) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new Error("Not base58");
    value = value * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }
  for (const char of text) {
    if (char !== "1") break;
    bytes.unshift(0); // each leading "1" is a leading zero byte
  }
  return new Uint8Array(bytes);
}

export function encodeBase58(bytes: Uint8Array): string {
  let value = 0n;
  for (const b of bytes) value = value * 256n + BigInt(b);
  let text = "";
  while (value > 0n) {
    text = ALPHABET[Number(value % 58n)] + text;
    value /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    text = "1" + text;
  }
  return text;
}

export function decodeBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
