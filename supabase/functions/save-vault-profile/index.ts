// Owner saves their first name, the guardian's first name and their time
// zone (FR-4), and gets a fresh invite link for the guardian (FR-13).
// Proof: a wallet-signed message from the vault's owner on Solana.
import { serviceClient, useSignatureOnce } from "../_shared/db.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";
import {
  hashInviteCode,
  INVITE_LIFETIME_MS,
  newInviteCode,
} from "../_shared/invites.ts";
import { readVault } from "../_shared/solana.ts";
import { AuthError, verifyWalletMessage } from "../_shared/wallet-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const { message, signature } = await req.json();
    const signed = await verifyWalletMessage({
      message,
      signature,
      action: "save guardian details",
    });
    const ownerName = signed.details["Your name"].trim();
    const guardianName = signed.details["Guardian name"].trim();
    const timeZone = signed.details["Time zone"];
    if (ownerName.length > 40 || guardianName.length > 40)
      return fail("Names can be at most 40 characters.");
    if (!Intl.supportedValuesOf("timeZone").includes(timeZone))
      return fail("That time zone isn't recognised.");

    const vault = await readVault(signed.vault);
    if (!vault) return fail("That vault doesn't exist on Solana yet.", 404);
    if (vault.owner !== signed.wallet)
      return fail("Only the vault's owner can do this.", 403);
    if (!vault.guardian)
      return fail("This vault has no guardian to invite.", 409);
    if (!(await useSignatureOnce(signature)))
      return fail("This request was already used. Try again.", 409);

    const db = serviceClient();
    const { error: profileError } = await db.from("vault_profiles").upsert({
      vault: signed.vault,
      owner: vault.owner,
      owner_name: ownerName,
      guardian_name: guardianName,
      owner_time_zone: timeZone,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    // A new link replaces any unused older ones (FR-13: "copy a new one").
    await db
      .from("invites")
      .delete()
      .eq("vault", signed.vault)
      .is("used_at", null);
    const code = newInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);
    const { error: inviteError } = await db.from("invites").insert({
      vault: signed.vault,
      guardian: vault.guardian,
      code_hash: await hashInviteCode(code),
      expires_at: expiresAt.toISOString(),
    });
    if (inviteError) throw inviteError;

    return json({ code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, 401);
    console.error(error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
});
