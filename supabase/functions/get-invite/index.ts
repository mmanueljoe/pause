// Anyone holding an invite link can see who invited them and which wallet
// was added. Never returns emails.
import { serviceClient } from "../_shared/db.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";
import { hashInviteCode, isInviteCode } from "../_shared/invites.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const { code } = await req.json();
    if (!isInviteCode(code)) return json({ status: "invalid" });
    const db = serviceClient();
    const { data: invite } = await db
      .from("invites")
      .select("vault, guardian, expires_at, used_at")
      .eq("code_hash", await hashInviteCode(code))
      .maybeSingle();
    if (!invite) return json({ status: "invalid" });

    const { data: profile } = await db
      .from("vault_profiles")
      .select("owner, owner_name, guardian_name")
      .eq("vault", invite.vault)
      .single();
    const base = {
      vault: invite.vault,
      guardian: invite.guardian,
      owner: profile?.owner ?? null,
      ownerName: profile?.owner_name ?? null,
      guardianName: profile?.guardian_name ?? null,
    };
    if (invite.used_at) return json({ status: "used", ...base });
    if (new Date(invite.expires_at) < new Date())
      return json({ status: "expired", ...base });
    return json({ status: "open", ...base, expiresAt: invite.expires_at });
  } catch (error) {
    console.error(error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
});
