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
