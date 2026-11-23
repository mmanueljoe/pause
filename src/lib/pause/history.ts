import {
  type Address,
  type Base58EncodedBytes,
  getBase58Encoder,
  type Signature,
} from "@solana/kit";

import {
  type ChangeAppliedEvent,
  type ChangeCancelledEvent,
  type ChangeProposedEvent,
  type DepositedEvent,
  getChangeAppliedEventDecoder,
  getChangeCancelledEventDecoder,
  getChangeProposedEventDecoder,
  getDepositedEventDecoder,
  getVaultCreatedEventDecoder,
  getWithdrawalApprovedEventDecoder,
  getWithdrawalReleasedEventDecoder,
  getWithdrawalRequestedEventDecoder,
  getWithdrawalStoppedEventDecoder,
  getWithdrawalWaitChangedEventDecoder,
  identifyPauseEvent,
  PAUSE_PROGRAM_ADDRESS,
  PauseEvent,
  type VaultCreatedEvent,
  type WithdrawalApprovedEvent,
  type WithdrawalReleasedEvent,
  type WithdrawalRequestedEvent,
  type WithdrawalStoppedEvent,
  type WithdrawalWaitChangedEvent,
} from "../../generated/pause";
import type { AppClient } from "../solana/client";
import { eventAuthorityAddress } from "./addresses";

export type VaultEvent =
  | { kind: "VaultCreated"; data: VaultCreatedEvent }
  | { kind: "Deposited"; data: DepositedEvent }
  | { kind: "WithdrawalRequested"; data: WithdrawalRequestedEvent }
  | { kind: "WithdrawalStopped"; data: WithdrawalStoppedEvent }
  | { kind: "WithdrawalApproved"; data: WithdrawalApprovedEvent }
  | { kind: "WithdrawalReleased"; data: WithdrawalReleasedEvent }
  | { kind: "WithdrawalWaitChanged"; data: WithdrawalWaitChangedEvent }
  | { kind: "ChangeProposed"; data: ChangeProposedEvent }
  | { kind: "ChangeApplied"; data: ChangeAppliedEvent }
  | { kind: "ChangeCancelled"; data: ChangeCancelledEvent };

export type HistoryItem = {
  signature: Signature;
  /** When the transaction landed, or null if the network didn't say. */
  time: Date | null;
  slot: bigint;
  event: VaultEvent;
};

/** Anchor marks every `emit_cpi!` event with these 8 bytes (EVENT_IX_TAG, little-endian). */
const EVENT_IX_TAG = new Uint8Array([
  0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d,
]);

function decodeEvent(bytes: Uint8Array): VaultEvent | null {
  let kind: PauseEvent;
  try {
    kind = identifyPauseEvent(bytes);
  } catch {
    return null;
  }
  switch (kind) {
    case PauseEvent.VaultCreated:
      return {
        kind: "VaultCreated",
        data: getVaultCreatedEventDecoder().decode(bytes),
      };
    case PauseEvent.Deposited:
      return {
        kind: "Deposited",
        data: getDepositedEventDecoder().decode(bytes),
      };
    case PauseEvent.WithdrawalRequested:
      return {
        kind: "WithdrawalRequested",
        data: getWithdrawalRequestedEventDecoder().decode(bytes),
      };
    case PauseEvent.WithdrawalStopped:
      return {
        kind: "WithdrawalStopped",
        data: getWithdrawalStoppedEventDecoder().decode(bytes),
      };
    case PauseEvent.WithdrawalApproved:
      return {
        kind: "WithdrawalApproved",
        data: getWithdrawalApprovedEventDecoder().decode(bytes),
      };
    case PauseEvent.WithdrawalReleased:
      return {
        kind: "WithdrawalReleased",
        data: getWithdrawalReleasedEventDecoder().decode(bytes),
      };
    case PauseEvent.WithdrawalWaitChanged:
      return {
        kind: "WithdrawalWaitChanged",
        data: getWithdrawalWaitChangedEventDecoder().decode(bytes),
      };
    case PauseEvent.ChangeProposed:
      return {
        kind: "ChangeProposed",
        data: getChangeProposedEventDecoder().decode(bytes),
      };
    case PauseEvent.ChangeApplied:
      return {
        kind: "ChangeApplied",
        data: getChangeAppliedEventDecoder().decode(bytes),
      };
    case PauseEvent.ChangeCancelled:
      return {
        kind: "ChangeCancelled",
        data: getChangeCancelledEventDecoder().decode(bytes),
      };
  }
}

// Transactions never change once confirmed, so each is fetched only once.
const transactionCache = new Map<string, HistoryItem[]>();

type Rpc = AppClient["rpc"];

/**
 * Reads the Pause events out of one transaction. An event counts only if it is
 * an inner instruction to the Pause program, signed by Pause's own event
 * authority: another program can't produce that, so events can't be faked.
 */
async function eventsOfTransaction(
  rpc: Rpc,
  signature: Signature,
  vault: Address,
  eventAuthority: Address
): Promise<HistoryItem[]> {
  const cached = transactionCache.get(signature);
  if (cached) return cached;

  const tx = await rpc
    .getTransaction(signature, {
      commitment: "confirmed",
      encoding: "json",
      maxSupportedTransactionVersion: 0,
    })
    .send();
  if (!tx || tx.meta?.err) return [];

  const keys: Address[] = [
    ...tx.transaction.message.accountKeys,
    ...(tx.meta?.loadedAddresses?.writable ?? []),
    ...(tx.meta?.loadedAddresses?.readonly ?? []),
  ];
  const base58 = getBase58Encoder();
  const items: HistoryItem[] = [];
  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (keys[ix.programIdIndex] !== PAUSE_PROGRAM_ADDRESS) continue;
      if (keys[ix.accounts[0]] !== eventAuthority) continue;
      const data = base58.encode(ix.data as Base58EncodedBytes) as Uint8Array;
      if (!EVENT_IX_TAG.every((b, i) => data[i] === b)) continue;
      const event = decodeEvent(data.slice(8));
      if (event && event.data.vault === vault) {
        items.push({
          signature,
          slot: tx.slot,
          time:
            tx.blockTime === null
              ? null
              : new Date(Number(tx.blockTime) * 1000),
          event,
        });
      }
    }
  }
  transactionCache.set(signature, items);
  return items;
}

/** Runs `fn` over `items` with at most `limit` at a time (public RPCs rate-limit). */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

/**
 * The newest `limit` transactions touching the vault, as events, newest
 * first. Every Pause instruction writes the vault, so this finds them all.
 */
export async function fetchVaultHistory(
  rpc: Rpc,
  vault: Address,
  limit: number,
  abortSignal?: AbortSignal
): Promise<{ items: HistoryItem[]; hasMore: boolean }> {
  const signatures = await rpc
    .getSignaturesForAddress(vault, { commitment: "confirmed", limit })
    .send({ abortSignal });
  const eventAuthority = await eventAuthorityAddress();
  const perTx = await mapLimited(
    signatures.filter((s) => s.err === null),
    4,
    (s) => eventsOfTransaction(rpc, s.signature, vault, eventAuthority)
  );
  // Signatures come newest first; events inside one transaction are in order, so reverse them.
  const items = perTx.flatMap((events) => [...events].reverse());
  return { items, hasMore: signatures.length === limit };
}
