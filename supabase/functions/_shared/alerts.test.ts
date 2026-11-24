// Run with: npm run backend:test
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  arrivalEmail,
  formatSol,
  formatTime,
  formatWait,
  guardianChangeEmail,
  guardianWithdrawalEmail,
  isNight,
  ownerWithdrawalEmail,
  urgentReasons,
  type WithdrawalAlert,
} from "./alerts.ts";

const SOL = 1_000_000_000n;
// 2 pm in Accra (UTC+0).
const AFTERNOON = new Date("2026-11-24T14:00:00Z");

const routine = {
  paidBefore: true,
  amountLamports: 2n * SOL,
  otherWaitingLamports: [],
  balanceLamports: 100n * SOL,
  requestedAt: AFTERNOON,
  timeZone: "Africa/Accra",
};

test("a small payment to a paid address in the afternoon is quiet", () => {
  assert.deepEqual(urgentReasons(routine), []);
});

test("a new address is urgent, even the owner's own wallet", () => {
  assert.deepEqual(urgentReasons({ ...routine, paidBefore: false }), [
    { kind: "new-address" },
  ]);
});

test("25% of the vault is urgent; 24% is not", () => {
  assert.deepEqual(urgentReasons({ ...routine, amountLamports: 25n * SOL }), [
    { kind: "share", percent: 25 },
  ]);
  assert.deepEqual(
    urgentReasons({ ...routine, amountLamports: 24n * SOL }),
    []
  );
});

test("the share counts withdrawals already waiting", () => {
  const reasons = urgentReasons({
    ...routine,
    amountLamports: 10n * SOL,
    otherWaitingLamports: [20n * SOL],
  });
  assert.deepEqual(reasons, [
    { kind: "share", percent: 30 },
    { kind: "another-waiting" },
  ]);
});

test("another waiting withdrawal is urgent", () => {
  assert.deepEqual(urgentReasons({ ...routine, otherWaitingLamports: [1n] }), [
    { kind: "another-waiting" },
  ]);
});

test("an empty vault doesn't divide by zero", () => {
  assert.deepEqual(urgentReasons({ ...routine, balanceLamports: 0n }), []);
});

test("night is 11 pm to 6 am in the owner's time zone", () => {
  const accra = "Africa/Accra"; // UTC+0
  assert.equal(isNight(new Date("2026-11-24T22:59:00Z"), accra), false);
  assert.equal(isNight(new Date("2026-11-24T23:00:00Z"), accra), true);
  assert.equal(isNight(new Date("2026-11-25T05:59:00Z"), accra), true);
  assert.equal(isNight(new Date("2026-11-25T06:00:00Z"), accra), false);
  // 23:30 UTC is 6:30 pm in New York: not night there.
  assert.equal(
    isNight(new Date("2026-11-24T23:30:00Z"), "America/New_York"),
    false
  );
});

test("night adds a reason; no time zone means no night rule", () => {
  const late = new Date("2026-11-24T23:30:00Z");
  assert.deepEqual(urgentReasons({ ...routine, requestedAt: late }), [
    { kind: "night" },
  ]);
  assert.deepEqual(
    urgentReasons({ ...routine, requestedAt: late, timeZone: null }),
    []
  );
});

test("formats SOL, waits and fixed times", () => {
  assert.equal(formatSol(2_500_000_000n), "2.5");
  assert.equal(formatSol(12n * SOL), "12");
  assert.equal(formatSol(890_880n), "0.00089088");
  assert.equal(formatWait(90_000), "1 day 1 hour");
  assert.equal(formatWait(300), "5 minutes");
  assert.equal(
    formatTime(new Date("2026-11-22T21:14:00Z"), "Africa/Accra"),
    "Sun 22 Nov at 9:14 pm, Accra time"
  );
  assert.match(formatTime(AFTERNOON, null), /, UTC$/);
});

const alert: WithdrawalAlert = {
  vault: "VAULT",
  id: 4n,
  recipient: "RecipientAddress1111111111111111111111111111",
  amountLamports: 12n * SOL,
  releaseAt: new Date("2026-11-22T21:14:00Z"),
  reasons: [{ kind: "new-address" }],
  ownerName: "Ama",
  timeZone: "Africa/Accra",
};

test("urgent guardian email is a quick decision with Stop and Approve now", () => {
  const email = guardianWithdrawalEmail("kofi@example.com", alert);
  assert.equal(
    email.subject,
    "Ama is sending 12 SOL to a new address. Was this Ama?"
  );
  assert.match(
    email.paragraphs[0],
    /^New address\. Ama is sending 12 SOL to Reci…1111\. It leaves the vault Sun 22 Nov at 9:14 pm, Accra time\.$/
  );
  assert.deepEqual(
    email.buttons?.map((b) => [b.label, b.path]),
    [
      ["Stop this payment", "/vaults/VAULT/payments/4"],
      ["Approve now", "/vaults/VAULT/payments/4"],
    ]
  );
});

test("quiet guardian email has only a View button", () => {
  const email = guardianWithdrawalEmail("kofi@example.com", {
    ...alert,
    reasons: [],
  });
  assert.match(email.subject, /address the vault has paid before$/);
  assert.deepEqual(
    email.buttons?.map((b) => b.label),
    ["View in Pause"]
  );
});

test("urgent owner email asks 'Was this you?' and links to the rescue", () => {
  const email = ownerWithdrawalEmail("ama@example.com", alert);
  assert.match(email.subject, /^Was this you\? Your wallet asked/);
  assert.deepEqual(
    email.buttons?.map((b) => b.path),
    ["/vaults/VAULT/payments/4", "/vault/withdraw?rescue=1"]
  );
  const quiet = ownerWithdrawalEmail("ama@example.com", {
    ...alert,
    reasons: [],
  });
  assert.equal(quiet.subject, "You asked to send 12 SOL");
});

test("removing the guardian tells the guardian plainly", () => {
  const email = guardianChangeEmail("kofi@example.com", {
    change: { kind: "guardian", newGuardian: null },
    applyAfter: new Date("2026-11-22T21:14:00Z"),
    ownerName: "Ama",
    timeZone: "Africa/Accra",
  });
  assert.equal(
    email.subject,
    "Ama's wallet asked to remove you as guardian. Was this Ama?"
  );
});

test("arrival email says where the money went", () => {
  const own = arrivalEmail("ama@example.com", {
    amountLamports: 2n * SOL,
    recipient: "OWNER",
    ownerWallet: "OWNER",
    early: false,
  });
  assert.equal(own.subject, "2 SOL arrived in your wallet");
  const other = arrivalEmail("ama@example.com", {
    amountLamports: 2n * SOL,
    recipient: "RecipientAddress1111111111111111111111111111",
    ownerWallet: "OWNER",
    early: true,
  });
  assert.equal(other.subject, "2 SOL reached Reci…1111");
  assert.match(other.paragraphs[0], /approved early by your guardian\.$/);
});
