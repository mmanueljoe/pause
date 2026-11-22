import {
  type Address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
} from "@solana/kit";

import { PAUSE_PROGRAM_ADDRESS } from "../../generated/pause";

// Seeds must match anchor/programs/pause/src/constants.rs.
const VAULT_SEED = "vault";
const WITHDRAWAL_SEED = "withdrawal";
const EVENT_AUTHORITY_SEED = "__event_authority";

/** The vault's address: PDA from `["vault", owner]`. */
export async function vaultAddress(owner: Address): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: PAUSE_PROGRAM_ADDRESS,
    seeds: [VAULT_SEED, getAddressEncoder().encode(owner)],
  });
  return address;
}

/**
 * A withdrawal's address: PDA from `["withdrawal", vault, id]`.
 * For a new request, `id` is the vault's `nextWithdrawalId`.
 */
export async function withdrawalAddress(
  vault: Address,
  id: bigint
): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: PAUSE_PROGRAM_ADDRESS,
    seeds: [
      WITHDRAWAL_SEED,
      getAddressEncoder().encode(vault),
      getU64Encoder().encode(id),
    ],
  });
  return address;
}

/** The address that signs Pause's events (`emit_cpi!`). */
export async function eventAuthorityAddress(): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: PAUSE_PROGRAM_ADDRESS,
    seeds: [EVENT_AUTHORITY_SEED],
  });
  return address;
}

export function explorerUrl(kind: "address" | "tx", value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=devnet`;
}
