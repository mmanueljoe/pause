import { createClient } from "@supabase/supabase-js";

/**
 * Database client with the service role: it bypasses row-level security, so
 * only use it after checking who is asking. Never send this key to a browser.
 */
export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase environment is missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Records a signature as used; false if it was used before (a replay). */
export async function useSignatureOnce(signature: string): Promise<boolean> {
  const { error } = await serviceClient()
    .from("used_signatures")
    .insert({ signature });
  if (!error) return true;
  if (error.code === "23505") return false; // unique violation: already used
  throw error;
}
