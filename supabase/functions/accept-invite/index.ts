// The guardian accepts an invite (FR-13): proves the wallet is theirs with a
// free signed message, gives an email for alerts, and uses up the link.
import { serviceClient, useSignatureOnce } from "../_shared/db.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";
import { hashInviteCode, isInviteCode } from "../_shared/invites.ts";
import { readVault } from "../_shared/solana.ts";
import { AuthError, verifyWalletMessage } from "../_shared/wallet-auth.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const { code, message, signature } = await req.json();
    if (!isInviteCode(code)) return fail("This invite link isn't valid.", 404);
    const signed = await verifyWalletMessage({
      message,
      signature,
      action: "accept invite",
    });
    const email = signed.details["Email"].trim();
    if (!EMAIL.test(email)) return fail("Enter a valid email address.");

    const db = serviceClient();
    const { data: invite } = await db
      .from("invites")
      .select("id, vault, guardian, expires_at, used_at")
      .eq("code_hash", await hashInviteCode(code))
      .maybeSingle();
    if (!invite || invite.vault !== signed.vault)
      return fail("This invite link isn't valid.", 404);
    if (invite.used_at) return fail("This invite was already accepted.", 409);
    if (new Date(invite.expires_at) < new Date())
      return fail("This invite has expired. Ask for a new link.", 410);
    if (invite.guardian !== signed.wallet) {
      return fail(
        "This isn't the wallet the owner added. Ask them to check the address.",
        403
      );
    }
    // Solana is the source of truth: the wallet must be the vault's guardian now.
    const vault = await readVault(signed.vault);
    if (!vault || vault.guardian !== signed.wallet) {
      return fail(
        "This wallet isn't the vault's guardian any more. Ask the owner for a new link.",
        403
      );
    }
    if (!(await useSignatureOnce(signature)))
      return fail("This request was already used. Try again.", 409);

    const { error: contactError } = await db.from("guardian_contacts").upsert({
      vault: signed.vault,
      guardian: signed.wallet,
      email,
      accepted_at: new Date().toISOString(),
    });
    if (contactError) throw contactError;
    await db
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    const { data: profile } = await db
      .from("vault_profiles")
      .select("owner_name")
      .eq("vault", signed.vault)
      .single();
    return json({ ok: true, ownerName: profile?.owner_name ?? null });
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, 401);
    console.error(error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
});
