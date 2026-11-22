import { useEffect, useMemo, useState } from "react";
import { type Address, address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { useRequestSWR, useTrackedDataSWR } from "@solana/react/swr";

import { PAUSE_PROGRAM_ADDRESS } from "../../generated/pause";
import type { AppClient } from "../solana/client";
import {
  decodeVaultAccount,
  decodeWithdrawalAccount,
  guardianFilters,
  type RawAccount,
  type VaultState,
  withdrawalsOfVaultFilters,
  type WithdrawalState,
} from "./accounts";
import { vaultAddress } from "./addresses";

const commitment = "confirmed" as const;

/** The connected wallet's address, or null. */
export function useWalletAddress(): Address | null {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  return useMemo(
    () => (connected ? address(connected.account.address) : null),
    [connected]
  );
}

/** Computes an async value (like a PDA) and keeps it in state. */
function useAsyncValue<T>(
  compute: (() => Promise<T>) | null,
  deps: unknown[]
): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    setValue(null);
    compute?.().then((v) => !cancelled && setValue(v));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** The vault address for `owner` (null while computing or with no owner). */
export function useVaultAddress(owner: Address | null): Address | null {
  return useAsyncValue(owner ? () => vaultAddress(owner) : null, [owner]);
}

export type LiveVault = {
  /** null = no vault at this address (or not loaded yet; see isLoading). */
  vault: VaultState | null;
  /** Slot of the latest data. Changes on every vault update. */
  slot: bigint | null;
  isLoading: boolean;
  error: unknown;
};

/**
 * A vault, kept live: first read plus a subscription, so the screen updates
 * within a second of any change (deposit, request, stop, release…).
 */
export function useVault(address: Address | null): LiveVault {
  const { rpc, rpcSubscriptions } = useClient<AppClient>();
  const spec = useMemo(
    () =>
      address
        ? {
            initialValueSource: rpc.getAccountInfo(address, {
              commitment,
              encoding: "base64",
            }),
            initialValueMapper: (account: RawAccount | null) =>
              decodeVaultAccount(address, account),
            streamSource: rpcSubscriptions.accountNotifications(address, {
              commitment,
              encoding: "base64",
            }),
            streamValueMapper: (account: RawAccount) =>
              decodeVaultAccount(address, account),
          }
        : null,
    [rpc, rpcSubscriptions, address]
  );
  const { data, error } = useTrackedDataSWR(
    address ? ["vault", address] : null,
    spec
  );
  return {
    vault: data?.value ?? null,
    slot: data?.context.slot ?? null,
    isLoading: address != null && data == null && error == null,
    error,
  };
}

/**
 * All withdrawals of a vault, newest first. Every withdrawal action also
 * writes the vault, so passing the vault's `slot` refetches the list exactly
 * when something changed.
 */
export function useWithdrawals(vault: Address | null, slot: bigint | null) {
  const { rpc } = useClient<AppClient>();
  const { data, error, isLoading, mutate } = useRequestSWR(
    vault ? ["withdrawals", vault, String(slot)] : null,
    vault
      ? async (signal: AbortSignal) => {
          const accounts = await rpc
            .getProgramAccounts(PAUSE_PROGRAM_ADDRESS, {
              commitment,
              encoding: "base64",
              filters: withdrawalsOfVaultFilters(vault),
            })
            .send({ abortSignal: signal });
          return accounts
            .map(({ pubkey, account }) =>
              decodeWithdrawalAccount(pubkey, account)
            )
            .filter((w): w is WithdrawalState => w !== null)
            .sort((a, b) => Number(b.data.id - a.data.id));
        }
      : null,
    { keepPreviousData: true }
  );
  return { withdrawals: data ?? [], isLoading, error, refresh: mutate };
}

/**
 * Vaults this wallet guards. The program keeps no list of guardians, so we
 * search every Pause vault whose `guardian` field equals this address.
 */
export function useGuardedVaults(guardian: Address | null) {
  const { rpc } = useClient<AppClient>();
  const { data, error, isLoading, mutate } = useRequestSWR(
    guardian ? ["guarded-vaults", guardian] : null,
    guardian
      ? async (signal: AbortSignal) => {
          const accounts = await rpc
            .getProgramAccounts(PAUSE_PROGRAM_ADDRESS, {
              commitment,
              encoding: "base64",
              filters: guardianFilters(guardian),
            })
            .send({ abortSignal: signal });
          return accounts
            .map(({ pubkey, account }) => decodeVaultAccount(pubkey, account))
            .filter((v): v is VaultState => v !== null);
        }
      : null,
    { refreshInterval: 15_000 }
  );
  return { vaults: data ?? [], isLoading, error, refresh: mutate };
}

export type Role = "owner" | "guardian" | "both" | "neither";

/**
 * FR-2: is the connected wallet an owner, a guardian, both, or neither?
 * `role` is null while still checking.
 */
export function useRole(wallet: Address | null) {
  const ownVaultAddress = useVaultAddress(wallet);
  const { vault, isLoading: vaultLoading } = useVault(ownVaultAddress);
  const { vaults: guarded, isLoading: guardedLoading } =
    useGuardedVaults(wallet);

  const checking =
    !wallet || !ownVaultAddress || vaultLoading || guardedLoading;
  let role: Role | null = null;
  if (!checking) {
    const isOwner = vault !== null;
    const isGuardian = guarded.length > 0;
    role =
      isOwner && isGuardian
        ? "both"
        : isOwner
          ? "owner"
          : isGuardian
            ? "guardian"
            : "neither";
  }
  return { role, ownVault: vault, guardedVaults: guarded };
}
