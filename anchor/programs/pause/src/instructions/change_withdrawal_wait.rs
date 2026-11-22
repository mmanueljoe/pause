//! US-11, US-17: the owner changes how long withdrawals wait. Longer is safer
//! and applies at once; shorter is less safe and waits the guardian wait.

use anchor_lang::prelude::*;

use crate::constants::VAULT_SEED;
use crate::errors::PauseError;
use crate::events::{ChangeProposed, WithdrawalWaitChanged};
use crate::state::{ChangeKind, Vault};

#[event_cpi]
#[derive(Accounts)]
pub struct ChangeWithdrawalWait<'info> {
    pub owner: Signer<'info>,

    /// Built from the signer's wallet, so only the owner can change settings.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handle_change_withdrawal_wait(
    ctx: Context<ChangeWithdrawalWait>,
    new_wait_secs: i64,
) -> Result<()> {
    Vault::check_withdrawal_wait(new_wait_secs)?;
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let old_wait_secs = vault.withdrawal_wait_secs;
    require!(new_wait_secs != old_wait_secs, PauseError::NoChange);

    if new_wait_secs > old_wait_secs {
        vault.withdrawal_wait_secs = new_wait_secs;
        emit_cpi!(WithdrawalWaitChanged {
            vault: vault_key,
            old_wait_secs,
            new_wait_secs,
        });
    } else {
        let now = Clock::get()?.unix_timestamp;
        let change = vault.propose_change(ChangeKind::WithdrawalWait { new_wait_secs }, now)?;
        emit_cpi!(ChangeProposed {
            vault: vault_key,
            kind: change.kind,
            apply_after: change.apply_after,
        });
    }

    Ok(())
}
