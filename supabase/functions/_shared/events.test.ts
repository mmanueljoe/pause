// Run with: npm run backend:test
import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeBase58, encodeBase58 } from "./base58.ts";
import {
  decodeEventInstruction,
  EVENT_IX_TAG,
  eventsInTransaction,
  type RpcTransaction,
} from "./events.ts";

const PROGRAM = "BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz";
const key = (n: number) => new Uint8Array(32).fill(n);
const u64 = (v: bigint) => {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = Number((v >> BigInt(8 * i)) & 0xffn);
  return out;
};
const i64 = (v: number) => u64(BigInt.asUintN(64, BigInt(v)));
const bytes = (...parts: (number[] | Uint8Array)[]) =>
  new Uint8Array(parts.flatMap((p) => [...p]));

const REQUESTED = [75, 207, 21, 12, 160, 102, 150, 55];
const STOPPED = [139, 158, 129, 134, 140, 174, 28, 24];
const PROPOSED = [170, 10, 10, 8, 244, 196, 146, 151];
const DEPOSITED = [111, 141, 26, 45, 161, 35, 100, 57];

function requestedData() {
  return bytes(
    EVENT_IX_TAG,
    REQUESTED,
    key(1), // vault
    key(2), // withdrawal
    u64(7n), // id
    key(3), // recipient
    u64(2_500_000_000n),
    i64(1_795_500_000)
  );
}

test("decodes WithdrawalRequested", () => {
  const event = decodeEventInstruction(requestedData());
  assert.deepEqual(event, {
    name: "WithdrawalRequested",
    vault: encodeBase58(key(1)),
    withdrawal: encodeBase58(key(2)),
    id: 7n,
    recipient: encodeBase58(key(3)),
    amountLamports: 2_500_000_000n,
    releaseAt: 1_795_500_000,
  });
});

test("decodes WithdrawalStopped", () => {
  const event = decodeEventInstruction(
    bytes(EVENT_IX_TAG, STOPPED, key(1), key(2), u64(3n), key(9))
  );
  assert.equal(event?.name, "WithdrawalStopped");
  assert.equal(
    event?.name === "WithdrawalStopped" && event.stoppedBy,
    encodeBase58(key(9))
  );
});

test("decodes ChangeProposed for each change kind", () => {
  const remove = decodeEventInstruction(
    bytes(EVENT_IX_TAG, PROPOSED, key(1), [0, 0], i64(100))
  );
  assert.deepEqual(remove, {
    name: "ChangeProposed",
    vault: encodeBase58(key(1)),
    change: { kind: "guardian", newGuardian: null },
    applyAfter: 100,
  });
  const swap = decodeEventInstruction(
    bytes(EVENT_IX_TAG, PROPOSED, key(1), [0, 1], key(5), i64(100))
  );
  assert.deepEqual(swap?.name === "ChangeProposed" && swap.change, {
    kind: "guardian",
    newGuardian: encodeBase58(key(5)),
  });
  const wait = decodeEventInstruction(
    bytes(EVENT_IX_TAG, PROPOSED, key(1), [1], i64(3600), i64(100))
  );
  assert.deepEqual(wait?.name === "ChangeProposed" && wait.change, {
    kind: "withdrawal-wait",
    newWaitSecs: 3600,
  });
});

test("ignores events that need no alert, and non-events", () => {
  assert.equal(
    decodeEventInstruction(
      bytes(EVENT_IX_TAG, DEPOSITED, key(1), key(2), u64(1n), u64(1n))
    ),
    null
  );
  assert.equal(decodeEventInstruction(bytes(REQUESTED, key(1))), null);
  assert.equal(decodeEventInstruction(new Uint8Array(4)), null);
});

test("throws on a truncated event (caller skips it)", () => {
  assert.throws(() => decodeEventInstruction(requestedData().subarray(0, 60)));
});

function tx(overrides: Partial<RpcTransaction["meta"]> = {}): RpcTransaction {
  return {
    blockTime: 1_795_400_000,
    meta: {
      err: null,
      innerInstructions: [
        {
          instructions: [
            { programIdIndex: 0, data: encodeBase58(requestedData()) }, // not Pause
            { programIdIndex: 2, data: encodeBase58(requestedData()) }, // Pause (looked up)
          ],
        },
      ],
      loadedAddresses: { writable: [], readonly: [PROGRAM] },
      ...overrides,
    },
    transaction: {
      message: {
        accountKeys: ["11111111111111111111111111111111", encodeBase58(key(8))],
      },
    },
  };
}

test("finds Pause events in inner instructions, including looked-up program ids", () => {
  const events = eventsInTransaction(tx(), PROGRAM);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "WithdrawalRequested");
});

test("failed transactions have no events", () => {
  assert.deepEqual(
    eventsInTransaction(tx({ err: { InstructionError: [0, "x"] } }), PROGRAM),
    []
  );
});

test("base58 round trip keeps leading zeros", () => {
  const data = bytes([0, 0, 5, 200]);
  assert.deepEqual(decodeBase58(encodeBase58(data)), data);
});
