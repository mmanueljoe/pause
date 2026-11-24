// Alert level and reasons per withdrawal (B3c), so the app shows the same
// "Why this looks urgent" as the email, including the night rule the app
// can't work out itself (it needs the owner's time zone, kept only here).
// Returns no names, emails or time zones.
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
    const { data, error } = await serviceClient()
      .from("withdrawal_alerts")
      .select("vault, withdrawal_id, level, reasons")
      .in("vault", vaults)
      .eq("status", "waiting");
    if (error) throw error;
    const result: Record<string, Record<string, unknown>> = {};
    for (const row of data ?? []) {
      result[row.vault] ??= {};
      result[row.vault][String(row.withdrawal_id)] = {
        level: row.level,
        reasons: row.reasons,
      };
    }
    return json(result);
  } catch (error) {
    console.error(error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
});
