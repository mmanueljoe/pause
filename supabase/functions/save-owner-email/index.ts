// The owner turns vault emails on or off (FR-9, FR-17): "Email me about my
// vault" in Settings. Optional: without an email they get in-app notices only.
// Proof: a wallet-signed message from the vault's owner on Solana.
import { serviceClient, useSignatureOnce } from "../_shared/db.ts";
import { corsHeaders, fail, json } from "../_shared/http.ts";
import { readVault } from "../_shared/solana.ts";
import { AuthError, verifyWalletMessage } from "../_shared/wallet-auth.ts";
import { parseWalletMessage } from "../_shared/message.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const { message, signature } = await req.json();
    const action =
      typeof message === "string" ? parseWalletMessage(message)?.action : null;
    if (action !== "save my email" && action !== "stop emailing me")
      return fail("The signed message is for a different action.", 401);
    const signed = await verifyWalletMessage({ message, signature, action });

    const email =
      action === "save my email" ? signed.details["Email"].trim() : null;
    if (email !== null && !EMAIL.test(email))
      return fail("Enter a valid email address.");

    const vault = await readVault(signed.vault);
    if (!vault) return fail("That vault doesn't exist on Solana yet.", 404);
    if (vault.owner !== signed.wallet)
      return fail("Only the vault's owner can do this.", 403);
    if (!(await useSignatureOnce(signature)))
      return fail("This request was already used. Try again.", 409);

    const { error } = await serviceClient().from("vault_profiles").upsert({
      vault: signed.vault,
      owner: vault.owner,
      owner_email: email,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return json({ ok: true, email });
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, 401);
    console.error(error);
    return fail("Something went wrong on our side. Try again.", 500);
  }
});
