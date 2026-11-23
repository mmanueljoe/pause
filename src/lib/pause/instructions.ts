import { type Address, none, some, type TransactionSigner } from "@solana/kit";

import {
  getCreateVaultInstructionAsync,
  getApplyChangeInstruction,
  getApproveWithdrawalInstruction,
  getChangeWithdrawalWaitInstructionAsync,
  getCancelChangeInstruction,
  getDepositInstructionAsync,
  getProposeGuardianChangeInstructionAsync,
  getReleaseWithdrawalInstruction,
  getRequestWithdrawalInstructionAsync,
  getStopWithdrawalInstruction,
  PAUSE_PROGRAM_ADDRESS,
} from "../../generated/pause";
import { eventAuthorityAddress, withdrawalAddress } from "./addresses";

/**
 * Builders for Pause instructions. They fill in the accounts every Pause
 * instruction needs (event authority, program), so screens only pass what
 * the person chose.
 */
async function eventAccounts() {
  return {
    eventAuthority: await eventAuthorityAddress(),
    program: PAUSE_PROGRAM_ADDRESS,
  };
}

/** US-2, US-3: create the owner's vault with a guardian and both waits. */
export async function createVaultInstruction(input: {
  owner: TransactionSigner;
  guardian: Address;
  withdrawalWaitSecs: number;
  guardianWaitSecs: number;
}) {
  return getCreateVaultInstructionAsync({
    owner: input.owner,
    guardian: input.guardian,
    withdrawalWaitSecs: BigInt(input.withdrawalWaitSecs),
    guardianWaitSecs: BigInt(input.guardianWaitSecs),
    ...(await eventAccounts()),
  });
}

/** US-4: move SOL from the owner's wallet into their vault. Instant. */
export async function depositInstruction(input: {
  owner: TransactionSigner;
  amountLamports: bigint;
}) {
  return getDepositInstructionAsync({
    owner: input.owner,
    amountLamports: input.amountLamports,
    ...(await eventAccounts()),
  });
}

/**
 * US-5: ask to send SOL from the vault. Nothing moves yet; it waits.
 * The new record's address uses the vault's current counter, so pass the
 * freshly read `nextWithdrawalId`.
 */
export async function requestWithdrawalInstruction(input: {
  owner: TransactionSigner;
  vault: Address;
  nextWithdrawalId: bigint;
  recipient: Address;
  amountLamports: bigint;
}) {
  return getRequestWithdrawalInstructionAsync({
    owner: input.owner,
    vault: input.vault,
    withdrawal: await withdrawalAddress(input.vault, input.nextWithdrawalId),
    recipient: input.recipient,
    amountLamports: input.amountLamports,
    ...(await eventAccounts()),
  });
}

/** US-8: the owner or guardian stops a waiting withdrawal. No SOL moves. */
export async function stopWithdrawalInstruction(input: {
  authority: TransactionSigner;
  vault: Address;
  withdrawal: Address;
}) {
  return getStopWithdrawalInstruction({ ...input, ...(await eventAccounts()) });
}

/** US-8a: the guardian approves a waiting withdrawal early; it's sent now. */
export async function approveWithdrawalInstruction(input: {
  guardian: TransactionSigner;
  vault: Address;
  withdrawal: Address;
  recipient: Address;
}) {
  return getApproveWithdrawalInstruction({
    ...input,
    ...(await eventAccounts()),
  });
}

/** US-9: anyone sends a withdrawal to its named recipient after the wait. */
export async function releaseWithdrawalInstruction(input: {
  vault: Address;
  withdrawal: Address;
  recipient: Address;
}) {
  return getReleaseWithdrawalInstruction({
    ...input,
    ...(await eventAccounts()),
  });
}

/** US-10, US-16: the owner or current guardian cancels the waiting change. */
export async function cancelChangeInstruction(input: {
  authority: TransactionSigner;
  vault: Address;
}) {
  return getCancelChangeInstruction({ ...input, ...(await eventAccounts()) });
}

/** US-11: longer applies at once; shorter waits the guardian wait. */
export async function changeWithdrawalWaitInstruction(input: {
  owner: TransactionSigner;
  newWaitSecs: number;
}) {
  return getChangeWithdrawalWaitInstructionAsync({
    owner: input.owner,
    newWaitSecs: BigInt(input.newWaitSecs),
    ...(await eventAccounts()),
  });
}

/**
 * US-10, US-19: propose a new guardian (an address) or removing the guardian
 * (null). Always waits the guardian wait.
 */
export async function proposeGuardianChangeInstruction(input: {
  owner: TransactionSigner;
  newGuardian: Address | null;
}) {
  return getProposeGuardianChangeInstructionAsync({
    owner: input.owner,
    newGuardian: input.newGuardian === null ? none() : some(input.newGuardian),
    ...(await eventAccounts()),
  });
}

/** Anyone makes the waiting change real once its wait has ended. */
export async function applyChangeInstruction(input: { vault: Address }) {
  return getApplyChangeInstruction({ ...input, ...(await eventAccounts()) });
}
