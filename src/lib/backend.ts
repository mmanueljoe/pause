import { useCallback } from "react";
import { type Address, getBase64Decoder } from "@solana/kit";
import {
  useConnectedWallet,
  useSignMessage,
} from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import useSWR from "swr";

import {
  buildWalletMessage,
  type WalletAction,
} from "../../supabase/functions/_shared/message";
import type { AppClient } from "./solana/client";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** False when the website runs without the Supabase settings (e.g. in CI). */
export const BACKEND_ENABLED = Boolean(URL && KEY);

export class BackendError extends Error {}

/** Calls one of our Edge Functions. Errors carry plain-language messages. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!BACKEND_ENABLED)
    throw new BackendError("Pause's server isn't set up here.");
  let response: Response;
  try {
    response = await fetch(`${URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { apikey: KEY!, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BackendError(
      "Couldn't reach Pause's server. Check your connection and try again."
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BackendError(
      typeof data.error === "string"
        ? data.error
        : "Something went wrong. Try again."
    );
  }
  return data as T;
}

/**
 * Asks the connected wallet to sign a Pause message (free, nothing sent on
 * Solana) and returns it with the base64 signature, ready for a function.
 */
export function useSignWalletMessage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const { dispatchAsync, isRunning } = useSignMessage(client);

  const sign = useCallback(
    async (
      action: WalletAction,
      vault: Address,
      details: Record<string, string>
    ) => {
      if (!connected) throw new BackendError("Connect your wallet first.");
      const message = buildWalletMessage({
        action,
        vault,
        wallet: connected.account.address,
        issued: new Date(),
        details,
      });
      let signature: Uint8Array;
      try {
        signature = (await dispatchAsync(
          new TextEncoder().encode(message)
        )) as Uint8Array;
      } catch (error) {
        const text = error instanceof Error ? error.message.toLowerCase() : "";
        throw new BackendError(
          /reject|denied|cancel/.test(text)
            ? "You closed the wallet before signing. Nothing was saved."
            : "Your wallet couldn't sign the message. Try again."
        );
      }
      return { message, signature: getBase64Decoder().decode(signature) };
    },
    [connected, dispatchAsync]
  );
  return { sign, isSigning: isRunning };
}

export type VaultProfile = {
  ownerName: string | null;
  guardianName: string | null;
  /** The owner gave an email in Settings (the address itself is never sent). */
  ownerEmailOn: boolean;
  /** Guardians who accepted their invite (and so get email alerts). */
  acceptedGuardians: string[];
};

/** First names and invite status for vaults (no emails). Missing = not set up. */
export function useVaultProfiles(vaults: Address[]) {
  const key =
    BACKEND_ENABLED && vaults.length ? ["vault-profile", ...vaults] : null;
  const { data, mutate } = useSWR(key, () =>
    callFunction<Record<string, VaultProfile>>("vault-profile", { vaults })
  );
  return { profiles: data ?? {}, refresh: mutate };
}

export type InviteInfo = {
  status: "open" | "used" | "expired" | "invalid";
  vault?: Address;
  guardian?: Address;
  owner?: Address | null;
  ownerName?: string | null;
  guardianName?: string | null;
  expiresAt?: string;
};

/** The full invite link for a code. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

/** The browser's time zone, e.g. "Africa/Accra" (for the night-time alert rule). */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
