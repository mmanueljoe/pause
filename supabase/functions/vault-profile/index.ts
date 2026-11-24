// First names and invite status for vaults, so screens can say "Kofi"
// instead of an address. Never returns emails or time zones (only whether
// the owner turned emails on).
import { serviceClient } from "../_shared/db.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const { vaults } = await req.json();
    if (
      !Array.isArray(vaults) ||
      vaults.length > 20 ||
      !vaults.every((v) => typeof v === "string" && ADDRESS.test(v))
    ) {
      return fail("Send up to 20 vault addresses.");
    }
    const db = serviceClient();
    const [{ data: profiles }, { data: contacts }] = await Promise.all([
      db
        .from("vault_profiles")
        .select("vault, owner_name, guardian_name, owner_email")
        .in("vault", vaults),
      db
        .from("guardian_contacts")
        .select("vault, guardian")
        .in("vault", vaults),
    ]);
    const result: Record<string, unknown> = {};
    for (const p of profiles ?? []) {
      result[p.vault] = {
        ownerName: p.owner_name,
        guardianName: p.guardian_name,
        ownerEmailOn: p.owner_email !== null,
        // Guardians who accepted (and so get email alerts) for this vault.
        acceptedGuardians: (contacts ?? [])
          .filter((c) => c.vault === p.vault)
          .map((c) => c.guardian),
      };
    }
    return json(result);
  } catch (error) {
    console.error(error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
});
