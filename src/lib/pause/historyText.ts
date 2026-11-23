import type { Address } from "@solana/kit";

import type { ChangeKind } from "../../generated/pause";
import {
  describeChange,
  formatDayTime,
  formatSol,
  formatWait,
  shortAddress,
} from "./format";
import type { HistoryItem } from "./history";

export type Category = "payments" | "stopped" | "settings";
export type Icon =
  "deposit" | "request" | "alert" | "stop" | "sent" | "settings";

export type HistoryLine = {
  key: string;
  item: HistoryItem;
  category: Category;
  icon: Icon;
  /** One full sentence naming who did it. */
  title: string;
  /** Extra detail after the time, e.g. "It stayed in your vault". */
  detail?: string;
  /** "+44.5 SOL", "−2 SOL" or "12 SOL". */
  amount?: string;
};

type Viewer = "owner" | "guardian";

/**
 * Turns events into sentences (FR-18). Walks oldest to newest so each line
 * knows the state at that moment: whether an address was new, and who the
 * guardian was. Routine requests read "You asked…"; ones to a new address
 * read "Your wallet asked…", because after a theft it may not have been you.
 */
export function toHistoryLines(
  items: HistoryItem[],
  viewer: Viewer,
  me: Address | null,
  owner: Address
): HistoryLine[] {
  const oldestFirst = [...items].reverse();
  const paid = new Set<string>();
  const requests = new Map<string, { amount: bigint; recipient: Address }>();
  let guardian: Address | null = null;
  const lines: HistoryLine[] = [];

  const you = (who: Address) => (who === me ? "You" : null);
  const ownerName = viewer === "owner" ? "You" : "The owner";
  const ownerWallet = viewer === "owner" ? "Your wallet" : "The owner's wallet";
  const vaultName = viewer === "owner" ? "your vault" : "the vault";
  const recipientName = (r: Address) =>
    r === owner
      ? viewer === "owner"
        ? "your wallet"
        : "the owner's wallet"
      : shortAddress(r);
  const guardianName = (g: Address) =>
    you(g) ??
    (g === guardian
      ? viewer === "owner"
        ? "Your guardian"
        : "The guardian"
      : `Guardian ${shortAddress(g)}`);

  oldestFirst.forEach((item, i) => {
    const key = `${item.signature}-${i}`;
    const e = item.event;
    switch (e.kind) {
      case "VaultCreated":
        guardian = e.data.guardian;
        lines.push({
          key,
          item,
          category: "settings",
          icon: "settings",
          title:
            viewer === "owner"
              ? `You created your vault with ${shortAddress(e.data.guardian)} as guardian`
              : e.data.guardian === me
                ? "The owner created this vault with you as guardian"
                : "The owner created this vault",
          detail: `Withdrawals wait ${formatWait(e.data.withdrawalWaitSecs)}`,
        });
        break;
      case "Deposited":
        lines.push({
          key,
          item,
          category: "payments",
          icon: "deposit",
          title: `${ownerName} deposited ${formatSol(e.data.amountLamports)}`,
          amount: `+${formatSol(e.data.amountLamports)}`,
        });
        break;
      case "WithdrawalRequested": {
        const isNew = !paid.has(e.data.recipient);
        requests.set(e.data.withdrawal, {
          amount: e.data.amountLamports,
          recipient: e.data.recipient,
        });
        lines.push({
          key,
          item,
          category: "payments",
          icon: isNew ? "alert" : "request",
          title: isNew
            ? `${ownerWallet} asked to send ${formatSol(e.data.amountLamports)} to a new address`
            : `${ownerName} asked to withdraw ${formatSol(e.data.amountLamports)} to ${recipientName(e.data.recipient)}`,
          detail: `Could arrive ${formatDayTime(new Date(Number(e.data.releaseAt) * 1000))}`,
        });
        break;
      }
      case "WithdrawalStopped": {
        const req = requests.get(e.data.withdrawal);
        const who =
          e.data.stoppedBy === owner
            ? ownerName
            : guardianName(e.data.stoppedBy);
        lines.push({
          key,
          item,
          category: "stopped",
          icon: "stop",
          title: req
            ? `${who} stopped a payment of ${formatSol(req.amount)} to ${recipientName(req.recipient)}`
            : `${who} stopped a payment`,
          detail: `It stayed in ${vaultName}`,
          amount: req ? formatSol(req.amount) : undefined,
        });
        break;
      }
      case "WithdrawalApproved":
        paid.add(e.data.recipient);
        lines.push({
          key,
          item,
          category: "payments",
          icon: "sent",
          title: `${guardianName(e.data.guardian)} sent ${formatSol(e.data.amountLamports)} to ${recipientName(e.data.recipient)} early`,
          detail: "Approved before the wait ended",
          amount: `−${formatSol(e.data.amountLamports)}`,
        });
        break;
      case "WithdrawalReleased":
        paid.add(e.data.recipient);
        lines.push({
          key,
          item,
          category: "payments",
          icon: "sent",
          title:
            e.data.recipient === owner
              ? `${formatSol(e.data.amountLamports)} arrived in ${recipientName(owner)}`
              : `${formatSol(e.data.amountLamports)} was sent to ${shortAddress(e.data.recipient)}`,
          amount: `−${formatSol(e.data.amountLamports)}`,
        });
        break;
      case "WithdrawalWaitChanged":
        lines.push({
          key,
          item,
          category: "settings",
          icon: "settings",
          title: `${ownerName} made withdrawals wait longer: ${formatWait(e.data.newWaitSecs)}`,
          detail: `Was ${formatWait(e.data.oldWaitSecs)}`,
        });
        break;
      case "ChangeProposed":
        lines.push({
          key,
          item,
          category: "settings",
          icon: "alert",
          title: `${ownerWallet} asked to ${describeChange(e.data.kind, guardian !== null)}`,
          detail: `Applies ${formatDayTime(new Date(Number(e.data.applyAfter) * 1000))} unless cancelled`,
        });
        break;
      case "ChangeApplied": {
        const text = appliedText(e.data.kind, viewer, me);
        if (e.data.kind.__kind === "Guardian") {
          guardian =
            e.data.kind.newGuardian.__option === "Some"
              ? e.data.kind.newGuardian.value
              : null;
        }
        lines.push({
          key,
          item,
          category: "settings",
          icon: "settings",
          title: text,
        });
        break;
      }
      case "ChangeCancelled": {
        const who =
          e.data.cancelledBy === owner
            ? ownerName
            : guardianName(e.data.cancelledBy);
        lines.push({
          key,
          item,
          category: "settings",
          icon: "stop",
          title: `${who} cancelled the request to ${describeChange(e.data.kind, guardian !== null)}`,
          detail: "Nothing changed",
        });
        break;
      }
    }
  });
  return lines.reverse();
}

function appliedText(
  kind: ChangeKind,
  viewer: Viewer,
  me: Address | null
): string {
  if (kind.__kind === "WithdrawalWait") {
    return `Withdrawals now wait ${formatWait(kind.newWaitSecs)}`;
  }
  if (kind.newGuardian.__option === "None") {
    return viewer === "owner"
      ? "Your guardian was removed"
      : "The guardian was removed";
  }
  if (kind.newGuardian.value === me) return "You became the guardian";
  return `${shortAddress(kind.newGuardian.value)} is now the guardian`;
}

/** When `me` became guardian of this vault, from its history (newest first). */
export function guardianSince(items: HistoryItem[], me: Address): Date | null {
  for (const item of items) {
    const e = item.event;
    if (e.kind === "VaultCreated" && e.data.guardian === me) return item.time;
    if (
      e.kind === "ChangeApplied" &&
      e.data.kind.__kind === "Guardian" &&
      e.data.kind.newGuardian.__option === "Some" &&
      e.data.kind.newGuardian.value === me
    ) {
      return item.time;
    }
  }
  return null;
}
