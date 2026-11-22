import {
  type Address,
  type Base58EncodedBytes,
  getAddressEncoder,
  getBase58Decoder,
  getBase64Encoder,
} from "@solana/kit";

import {
  getVaultDecoder,
  getWithdrawalDecoder,
  PAUSE_PROGRAM_ADDRESS,
  VAULT_DISCRIMINATOR,
  WITHDRAWAL_DISCRIMINATOR,
  type Vault,
  type Withdrawal,
} from "../../generated/pause";

/** Raw account as returned by the RPC with `encoding: "base64"`. */
export type RawAccount = {
  data: readonly [string, "base64"] | [string, "base64"];
  lamports: bigint;
  owner: Address;
};

export type VaultState = {
  address: Address;
  data: Vault;
  /** The owner's money: SOL above the rent minimum. */
  balance: bigint;
  /** Balance minus SOL already promised to waiting withdrawals. */
  available: bigint;
};

export type WithdrawalState = {
  address: Address;
  data: Withdrawal;
};

/**
 * Smallest balance Solana requires an account of `dataLength` bytes to keep
 * (rent-exempt minimum). Fixed formula: (128 + bytes) × 3480 × 2 lamports.
 */
export function rentExemptMinimum(dataLength: number): bigint {
  return BigInt(128 + dataLength) * 3480n * 2n;
}

function bytesOf(account: RawAccount): Uint8Array {
  return getBase64Encoder().encode(account.data[0]) as Uint8Array;
}

function hasDiscriminator(bytes: Uint8Array, discriminator: Uint8Array) {
  return discriminator.every((b, i) => bytes[i] === b);
}

/**
 * Decodes a vault. Returns null if the account doesn't exist or isn't a Pause
 * vault (on-chain data is untrusted: check owner and discriminator first).
 */
export function decodeVaultAccount(
  address: Address,
  account: RawAccount | null
): VaultState | null {
  if (!account || account.owner !== PAUSE_PROGRAM_ADDRESS) return null;
  const bytes = bytesOf(account);
  if (!hasDiscriminator(bytes, VAULT_DISCRIMINATOR as Uint8Array)) return null;
  const data = getVaultDecoder().decode(bytes);
  const balance = account.lamports - rentExemptMinimum(bytes.length);
  const safeBalance = balance > 0n ? balance : 0n;
  const available = safeBalance - data.reservedLamports;
  return {
    address,
    data,
    balance: safeBalance,
    available: available > 0n ? available : 0n,
  };
}

export function decodeWithdrawalAccount(
  address: Address,
  account: RawAccount
): WithdrawalState | null {
  if (account.owner !== PAUSE_PROGRAM_ADDRESS) return null;
  const bytes = bytesOf(account);
  if (!hasDiscriminator(bytes, WITHDRAWAL_DISCRIMINATOR as Uint8Array)) {
    return null;
  }
  return { address, data: getWithdrawalDecoder().decode(bytes) };
}

const base58 = getBase58Decoder();

/** Filter: only accounts of this type (first 8 bytes = discriminator). */
function discriminatorFilter(discriminator: Uint8Array) {
  return {
    memcmp: {
      offset: 0n,
      bytes: base58.decode(discriminator) as Base58EncodedBytes,
      encoding: "base58" as const,
    },
  };
}

/**
 * Filters for "every vault whose guardian is `guardian`".
 * Vault layout: discriminator (8) · owner (32) · guardian Option tag (1) + address (32).
 * So bytes 40..73 are [1 (= Some), ...guardian].
 */
export function guardianFilters(guardian: Address) {
  const someGuardian = new Uint8Array([
    1,
    ...getAddressEncoder().encode(guardian),
  ]);
  return [
    discriminatorFilter(VAULT_DISCRIMINATOR as Uint8Array),
    {
      memcmp: {
        offset: 40n,
        bytes: base58.decode(someGuardian) as Base58EncodedBytes,
        encoding: "base58" as const,
      },
    },
  ];
}

/**
 * Filters for "every withdrawal of `vault`".
 * Withdrawal layout: discriminator (8) · vault (32) · …
 */
export function withdrawalsOfVaultFilters(vault: Address) {
  return [
    discriminatorFilter(WITHDRAWAL_DISCRIMINATOR as Uint8Array),
    {
      memcmp: {
        offset: 8n,
        bytes: vault as unknown as Base58EncodedBytes,
        encoding: "base58" as const,
      },
    },
  ];
}
