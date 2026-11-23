/** Invite links: a random code in the URL; only its SHA-256 hash is stored. */

export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60_000;

/** 18 random bytes as URL-safe base64 (24 characters). */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

export async function hashInviteCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code)
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function isInviteCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9_-]{24}$/.test(code);
}
