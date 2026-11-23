import { type Address, type TransactionSigner } from "@solana/kit";

import {
  getCreateVaultInstructionAsync,
  PAUSE_PROGRAM_ADDRESS,
} from "../../generated/pause";
import { eventAuthorityAddress } from "./addresses";

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
