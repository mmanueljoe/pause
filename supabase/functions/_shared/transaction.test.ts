// Run with: npm run backend:test
// Checks the hand-built transaction against the official Solana SDK
// (@solana/kit, installed for the website).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createKeyPairFromPrivateKeyBytes,
  getAddressFromPublicKey,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";

import { encodeBase58 } from "./base58.ts";
import {
  EVENT_AUTHORITY,
  PAUSE_PROGRAM,
  releaseMessage,
  signerFromSeed,
  signTransaction,
} from "./transaction.ts";

const seed = new Uint8Array(32).map((_, i) => i + 1);
const addr = (n: number) => encodeBase58(new Uint8Array(32).fill(n));
const accounts = {
  vault: addr(11),
  withdrawal: addr(12),
  recipient: addr(13),
  recentBlockhash: addr(14),
};

test("the backend wallet's address matches the Solana SDK's", async () => {
  const signer = await signerFromSeed(seed);
  const keyPair = await createKeyPairFromPrivateKeyBytes(seed);
  assert.equal(
    signer.address,
    await getAddressFromPublicKey(keyPair.publicKey)
  );
});

test("the release transaction decodes with the Solana SDK, signed by the payer", async () => {
  const signer = await signerFromSeed(seed);
  const wire = await signTransaction(
    releaseMessage({ payer: signer.address, ...accounts }),
    signer
  );
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
  const message = getCompiledTransactionMessageDecoder().decode(
    tx.messageBytes
  );

  assert.deepEqual(message.header, {
    numSignerAccounts: 1,
    numReadonlySignerAccounts: 0,
    numReadonlyNonSignerAccounts: 2,
  });
  assert.deepEqual(message.staticAccounts, [
    signer.address,
    accounts.vault,
    accounts.withdrawal,
    accounts.recipient,
    EVENT_AUTHORITY,
    PAUSE_PROGRAM,
  ]);
  assert.equal(message.lifetimeToken, accounts.recentBlockhash);
  assert.equal(message.instructions.length, 1);
  const ix = message.instructions[0];
  assert.equal(message.staticAccounts[ix.programAddressIndex], PAUSE_PROGRAM);
  assert.deepEqual(ix.accountIndices, [1, 2, 3, 4, 5]);
  assert.deepEqual([...(ix.data ?? [])], [165, 252, 155, 233, 0, 47, 81, 143]);

  // The signature is the payer's, over exactly these message bytes.
  const keyPair = await createKeyPairFromPrivateKeyBytes(seed);
  const signature = tx.signatures[signer.address];
  assert.ok(signature);
  assert.ok(
    await crypto.subtle.verify(
      { name: "Ed25519" },
      keyPair.publicKey,
      signature,
      tx.messageBytes
    )
  );
});

test("refuses a release where two accounts are the same", async () => {
  const signer = await signerFromSeed(seed);
  assert.throws(() =>
    releaseMessage({
      payer: signer.address,
      ...accounts,
      recipient: signer.address,
    })
  );
});
