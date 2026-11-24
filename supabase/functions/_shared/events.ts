/**
 * Reads Pause program events out of a Solana transaction, without the Solana
 * SDK (too large for Supabase's bundler). Pure: no Deno APIs, so it can be
 * tested with Node.
 *
 * The program emits events with Anchor's `emit_cpi!`: an inner instruction to
 * the Pause program whose data is EVENT_IX_TAG, then the event's 8-byte
 * discriminator, then its fields in Borsh. Only the program can sign that
 * inner instruction (its event-authority PDA), so it can't be faked by
 * another program or a top-level instruction.
 *
 * Layouts: anchor/programs/pause/src/events.rs. Discriminators:
 * anchor/target/idl/pause.json.
 */
import { decodeBase58, encodeBase58 } from "./base58.ts";

/** Anchor's EVENT_IX_TAG (0x1d9acb512ea545e4), little-endian. */
export const EVENT_IX_TAG = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d];

const DISCRIMINATORS = {
  WithdrawalRequested: [75, 207, 21, 12, 160, 102, 150, 55],
  WithdrawalStopped: [139, 158, 129, 134, 140, 174, 28, 24],
  WithdrawalApproved: [118, 139, 166, 230, 81, 241, 215, 154],
  WithdrawalReleased: [62, 109, 29, 142, 148, 189, 159, 160],
  ChangeProposed: [170, 10, 10, 8, 244, 196, 146, 151],
  ChangeApplied: [226, 1, 224, 100, 192, 110, 58, 24],
  ChangeCancelled: [139, 179, 97, 81, 214, 21, 119, 93],
} as const;

/** A less-safe change (state/vault.rs ChangeKind). */
export type ChangeKind =
  | { kind: "guardian"; newGuardian: string | null }
  | { kind: "withdrawal-wait"; newWaitSecs: number };

export type PauseEvent =
  | {
      name: "WithdrawalRequested";
      vault: string;
      withdrawal: string;
      id: bigint;
      recipient: string;
      amountLamports: bigint;
      releaseAt: number;
    }
  | {
      name: "WithdrawalStopped";
      vault: string;
      withdrawal: string;
      id: bigint;
      stoppedBy: string;
    }
  | {
      name: "WithdrawalApproved";
      vault: string;
      withdrawal: string;
      id: bigint;
      guardian: string;
      recipient: string;
      amountLamports: bigint;
    }
  | {
      name: "WithdrawalReleased";
      vault: string;
      withdrawal: string;
      id: bigint;
      recipient: string;
      amountLamports: bigint;
    }
  | {
      name: "ChangeProposed";
      vault: string;
      change: ChangeKind;
      applyAfter: number;
    }
  | { name: "ChangeApplied"; vault: string; change: ChangeKind }
  | {
      name: "ChangeCancelled";
      vault: string;
      change: ChangeKind;
      cancelledBy: string;
    };

/** Reads Borsh fields in order; throws if the bytes run out. */
class Reader {
  private offset = 0;
  private readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  private take(n: number): Uint8Array {
    if (this.offset + n > this.bytes.length) throw new Error("Event too short");
    const out = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }
  pubkey(): string {
    return encodeBase58(this.take(32));
  }
  u8(): number {
    return this.take(1)[0];
  }
  u64(): bigint {
    const b = this.take(8);
    let value = 0n;
    for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(b[i]);
    return value;
  }
  i64(): number {
    return Number(BigInt.asIntN(64, this.u64()));
  }
  change(): ChangeKind {
    const variant = this.u8();
    if (variant === 0) {
      const some = this.u8();
      if (some > 1) throw new Error("Bad option");
      return { kind: "guardian", newGuardian: some ? this.pubkey() : null };
    }
    if (variant === 1)
      return { kind: "withdrawal-wait", newWaitSecs: this.i64() };
    throw new Error("Unknown change kind");
  }
}

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0) {
  return prefix.every((b, i) => bytes[at + i] === b);
}

/**
 * Decodes one inner instruction's data (raw bytes). Returns null for anything
 * that isn't a Pause event we act on (VaultCreated, Deposited and
 * WithdrawalWaitChanged need no alert).
 */
export function decodeEventInstruction(data: Uint8Array): PauseEvent | null {
  if (data.length < 16 || !startsWith(data, EVENT_IX_TAG)) return null;
  const name = (
    Object.keys(DISCRIMINATORS) as (keyof typeof DISCRIMINATORS)[]
  ).find((n) => startsWith(data, DISCRIMINATORS[n], 8));
  if (!name) return null;
  const r = new Reader(data.subarray(16));
  switch (name) {
    case "WithdrawalRequested":
      return {
        name,
        vault: r.pubkey(),
        withdrawal: r.pubkey(),
        id: r.u64(),
        recipient: r.pubkey(),
        amountLamports: r.u64(),
        releaseAt: r.i64(),
      };
    case "WithdrawalStopped":
      return {
        name,
        vault: r.pubkey(),
        withdrawal: r.pubkey(),
        id: r.u64(),
        stoppedBy: r.pubkey(),
      };
    case "WithdrawalApproved":
      return {
        name,
        vault: r.pubkey(),
        withdrawal: r.pubkey(),
        id: r.u64(),
        guardian: r.pubkey(),
        recipient: r.pubkey(),
        amountLamports: r.u64(),
      };
    case "WithdrawalReleased":
      return {
        name,
        vault: r.pubkey(),
        withdrawal: r.pubkey(),
        id: r.u64(),
        recipient: r.pubkey(),
        amountLamports: r.u64(),
      };
    case "ChangeProposed":
      return {
        name,
        vault: r.pubkey(),
        change: r.change(),
        applyAfter: r.i64(),
      };
    case "ChangeApplied":
      return { name, vault: r.pubkey(), change: r.change() };
    case "ChangeCancelled":
      return {
        name,
        vault: r.pubkey(),
        change: r.change(),
        cancelledBy: r.pubkey(),
      };
  }
}

/** The parts of a `getTransaction` (encoding "json") result we read. */
export type RpcTransaction = {
  blockTime: number | null;
  meta: {
    err: unknown;
    innerInstructions?: {
      instructions: { programIdIndex: number; data: string }[];
    }[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
  transaction: { message: { accountKeys: string[] } };
};

/** Every Pause event in a successful transaction, in order. */
export function eventsInTransaction(
  tx: RpcTransaction,
  programAddress: string
): PauseEvent[] {
  if (!tx.meta || tx.meta.err) return [];
  // Versioned transactions list looked-up addresses after the static ones.
  const keys = [
    ...tx.transaction.message.accountKeys,
    ...(tx.meta.loadedAddresses?.writable ?? []),
    ...(tx.meta.loadedAddresses?.readonly ?? []),
  ];
  const events: PauseEvent[] = [];
  for (const group of tx.meta.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (keys[ix.programIdIndex] !== programAddress) continue;
      let event: PauseEvent | null = null;
      try {
        event = decodeEventInstruction(decodeBase58(ix.data));
      } catch {
        event = null; // not an event we understand; skip it
      }
      if (event) events.push(event);
    }
  }
  return events;
}
