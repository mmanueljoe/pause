//! Events the program emits so the backend can send alerts and keep history.
//! Emitted with `emit_cpi!`, which records them in the transaction itself
//! (not in logs, which can be cut short).

use anchor_lang::prelude::*;

#[event]
pub struct VaultCreated {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub guardian: Pubkey,
    pub withdrawal_wait_secs: i64,
    pub guardian_wait_secs: i64,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount_lamports: u64,
    /// The vault's balance after the deposit (SOL above the rent minimum).
    pub balance_lamports: u64,
}

#[event]
pub struct WithdrawalRequested {
    pub vault: Pubkey,
    pub withdrawal: Pubkey,
    pub id: u64,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub release_at: i64,
}

#[event]
pub struct WithdrawalStopped {
    pub vault: Pubkey,
    pub withdrawal: Pubkey,
    pub id: u64,
    /// The owner or the guardian.
    pub stopped_by: Pubkey,
}

#[event]
pub struct WithdrawalApproved {
    pub vault: Pubkey,
    pub withdrawal: Pubkey,
    pub id: u64,
    pub guardian: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct WithdrawalReleased {
    pub vault: Pubkey,
    pub withdrawal: Pubkey,
    pub id: u64,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
}
