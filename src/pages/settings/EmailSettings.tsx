import { useState } from "react";
import type { Address } from "@solana/kit";
import { Check, Info } from "lucide-react";

import { Button, Card, Input, useToast } from "../../components/ui";
import {
  BACKEND_ENABLED,
  BackendError,
  callFunction,
  useSignWalletMessage,
  type VaultProfile,
} from "../../lib/backend";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * "Email me about my vault" (FR-9, FR-17). Optional: without an email the
 * owner gets in-app notices only. Saving is a free wallet signature.
 */
export function EmailSettings({
  vault,
  profile,
  onChanged,
}: {
  vault: Address;
  profile: VaultProfile | undefined;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { sign, isSigning } = useSignWalletMessage();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The address is never sent back to the browser, so show the one just saved.
  const [saved, setSaved] = useState<string | null>(null);

  if (!BACKEND_ENABLED) return null;
  const on = saved !== null || (profile?.ownerEmailOn ?? false);
  const value = email.trim();
  const fieldError =
    touched && value !== "" && !EMAIL.test(value)
      ? "Enter a valid email address."
      : undefined;

  async function save(turnOff: boolean) {
    setError(null);
    setBusy(true);
    try {
      const signed = turnOff
        ? await sign("stop emailing me", vault, {})
        : await sign("save my email", vault, { Email: value });
      await callFunction("save-owner-email", signed);
      setSaved(turnOff ? null : value);
      setEditing(false);
      setEmail("");
      setTouched(false);
      toast(
        "success",
        turnOff ? "Emails turned off." : "We'll email you about your vault."
      );
      onChanged();
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

  const form = (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (EMAIL.test(value)) void save(false);
      }}
    >
      <Input
        label="Your email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched(true)}
        error={fieldError}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy && !isSigning} disabled={busy}>
          {isSigning ? "Check your wallet…" : "Save"}
        </Button>
        {on && (
          <Button
            type="button"
            variant="link"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Keep my current email
          </Button>
        )}
      </div>
    </form>
  );

  return (
    <Card className="flex flex-col gap-4">
      <span className="text-small text-text-2">Email me about my vault</span>
      {on && !editing ? (
        <>
          <p className="flex items-center gap-2">
            <Check size={20} strokeWidth={1.5} aria-hidden />
            {saved ? `Emails go to ${saved}` : "Emails are on"}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              Change email
            </Button>
            <Button
              variant="link"
              onClick={() => save(true)}
              loading={busy && !isSigning}
              disabled={busy}
            >
              {isSigning ? "Check your wallet…" : "Turn off emails"}
            </Button>
          </div>
        </>
      ) : (
        form
      )}
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <p className="flex items-start gap-2 text-small text-text-2">
        <Info size={20} strokeWidth={1.5} className="shrink-0" aria-hidden />
        <span>
          We'll email you when a withdrawal is waiting, so you notice one you
          didn't make. Without an email, you only see notices here in Pause.
          Saving asks your wallet to sign a message. It's free and moves no
          money.
        </span>
      </p>
    </Card>
  );
}
