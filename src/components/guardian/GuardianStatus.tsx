import { useState } from "react";
import type { Address } from "@solana/kit";
import { Check, CircleAlert } from "lucide-react";

import type { VaultProfile } from "../../lib/backend";
import { BACKEND_ENABLED } from "../../lib/backend";
import { Button } from "../ui";
import { Dialog } from "../ui/Dialog";
import { InviteLinkPanel } from "./InviteLinkPanel";

/**
 * Under the guardian's name: "Gets email alerts", or a nudge to send (or
 * re-send) the invite, which opens the invite-link panel.
 */
export function GuardianStatus({
  vault,
  guardian,
  profile,
  onChanged,
}: {
  vault: Address;
  guardian: Address;
  profile: VaultProfile | undefined;
  onChanged: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  if (!BACKEND_ENABLED) return null;
  const accepted = profile?.acceptedGuardians.includes(guardian) ?? false;
  const name = profile?.guardianName ?? "your guardian";

  return (
    <>
      {accepted ? (
        <p className="flex items-center gap-2 text-small text-text-2">
          <Check size={20} strokeWidth={1.5} aria-hidden />
          Gets email alerts
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="flex items-start gap-2 text-small text-text-2">
            <CircleAlert
              size={20}
              strokeWidth={1.5}
              className="shrink-0"
              aria-hidden
            />
            {profile
              ? `${name} hasn't accepted the invite yet, so they don't get email alerts.`
              : "Send your guardian an invite so they get email alerts."}
          </p>
          <Button variant="link" onClick={() => setInviting(true)}>
            {profile ? "Get a new invite link" : "Invite your guardian"}
          </Button>
        </div>
      )}
      {inviting && (
        <Dialog title="Invite your guardian" onClose={() => setInviting(false)}>
          <InviteLinkPanel
            vault={vault}
            ownerName={profile?.ownerName ?? ""}
            guardianName={profile?.guardianName ?? ""}
            onCreated={onChanged}
          />
        </Dialog>
      )}
    </>
  );
}
