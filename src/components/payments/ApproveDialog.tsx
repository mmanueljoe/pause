import type { VaultState, WithdrawalState } from "../../lib/pause/accounts";
import { formatSol, shortAddress } from "../../lib/pause/format";
import { Button } from "../ui";
import { Dialog } from "../ui/Dialog";
import { useWithdrawalActions } from "./useWithdrawalActions";

/** Approve now can't be undone, so it asks first (FR-11a). Stop never asks. */
export function ApproveDialog({
  vault,
  withdrawal,
  onClose,
}: {
  vault: VaultState;
  withdrawal: WithdrawalState;
  onClose: () => void;
}) {
  const { approve, isSending, error } = useWithdrawalActions(vault, withdrawal);
  const amount = formatSol(withdrawal.data.amountLamports);

  return (
    <Dialog
      title={`Send ${amount} now?`}
      onClose={onClose}
      closable={!isSending}
    >
      <p className="-mt-2 text-text-2">
        It leaves the vault at once and goes to{" "}
        <span className="font-mono text-small text-text">
          {shortAddress(withdrawal.data.recipient)}
        </span>
        . This can't be undone.
      </p>
      <p>
        Only approve if the owner told you themselves, by call or in person.
      </p>
      {error && (
        <p className="text-small text-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button
          variant="approve"
          size="large"
          fullWidth
          onClick={async () => (await approve()) && onClose()}
          loading={isSending}
        >
          Approve and send now
        </Button>
        <Button
          variant="secondary"
          size="large"
          fullWidth
          onClick={onClose}
          disabled={isSending}
        >
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
