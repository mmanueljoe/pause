import { useState } from "react";
import type { Address } from "@solana/kit";
import { Check, Copy } from "lucide-react";

import {
  BackendError,
  browserTimeZone,
  callFunction,
  inviteUrl,
  useSignWalletMessage,
} from "../../lib/backend";
import { Button, Input } from "../ui";

/**
 * Saves the owner's and guardian's first names (Supabase only, never on
 * Solana) and makes a one-time invite link for the guardian (FR-4, FR-13).
 * The wallet signs a free message showing exactly what's saved.
 */
export function InviteLinkPanel({
  vault,
  ownerName: initialOwnerName = "",
  guardianName: initialGuardianName = "",
  onCreated,
}: {
  vault: Address;
  ownerName?: string;
  guardianName?: string;
  onCreated?: () => void;
}) {
  const { sign, isSigning } = useSignWalletMessage();
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [guardianName, setGuardianName] = useState(initialGuardianName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: Date } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const valid = ownerName.trim().length > 0 && guardianName.trim().length > 0;
  const who = guardianName.trim() || "your guardian";

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const signed = await sign("save guardian details", vault, {
        "Your name": ownerName.trim(),
        "Guardian name": guardianName.trim(),
        "Time zone": browserTimeZone(),
      });
      const result = await callFunction<{ code: string; expiresAt: string }>(
        "save-vault-profile",
        signed
      );
      setLink({
        url: inviteUrl(result.code),
        expiresAt: new Date(result.expiresAt),
      });
      onCreated?.();
    } catch (e) {
      setError(
        e instanceof BackendError
          ? e.message
          : "Something went wrong. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still selectable on screen.
    }
  }

  if (link) {
    return (
      <div className="flex flex-col gap-3">
        <p>Send this link to {who} by message or email.</p>
        <div className="flex items-center gap-2 rounded-input border border-line bg-surface-2 p-3">
          <span
            className="min-w-0 flex-1 truncate font-mono text-small"
            title={link.url}
          >
            {link.url}
          </span>
          <Button
            variant="secondary"
            onClick={copy}
            aria-label="Copy invite link"
          >
            {copied ? (
              <>
                <Check size={16} strokeWidth={1.5} aria-hidden /> Copied
              </>
            ) : (
              <>
                <Copy size={16} strokeWidth={1.5} aria-hidden /> Copy
              </>
            )}
          </Button>
        </div>
        <p className="text-small text-text-2">
          It works once and expires{" "}
          {link.expiresAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
          . When {who} accepts, they get email alerts about your vault.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Your first name"
          autoComplete="given-name"
          maxLength={40}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          help="So they know the invite is from you."
          disabled={busy}
        />
        <Input
          label="Their first name"
          maxLength={40}
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
          help={'We use it in alerts, like "Kofi will be told."'}
          disabled={busy}
        />
      </div>
      <p className="text-small text-text-2">
        Your wallet asks you to sign a message. It's free and moves no money.
        Names are kept by Pause, never on Solana.
      </p>
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <Button
        onClick={create}
        loading={busy && !isSigning}
        disabled={!valid || busy}
      >
        {isSigning
          ? "Check your wallet…"
          : `Get ${guardianName.trim() ? `${guardianName.trim()}'s` : "the"} invite link`}
      </Button>
    </div>
  );
}
