//! US-8: the owner or guardian stops a waiting withdrawal. No SOL moves.

use anchor_lang::prelude::*;

use crate::constants::{VAULT_SEED, WITHDRAWAL_SEED};
use crate::errors::PauseError;
use crate::events::WithdrawalStopped;
use crate::state::{Vault, Withdrawal};

#[event_cpi]
#[derive(Accounts)]
pub struct StopWithdrawal<'info> {
    /// The owner or the guardian.
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        constraint = authority.key() == vault.owner || vault.is_guardian(&authority.key())
            @ PauseError::NotOwnerOrGuardian,
    )]
    pub vault: Account<'info, Vault>,

    /// Its address is built from this vault, so it must belong to this vault.
    #[account(
        mut,
        seeds = [WITHDRAWAL_SEED, vault.key().as_ref(), &withdrawal.id.to_le_bytes()],
        bump = withdrawal.bump,
    )]
    pub withdrawal: Account<'info, Withdrawal>,
}

pub fn handle_stop_withdrawal(ctx: Context<StopWithdrawal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let stopped_by = ctx.accounts.authority.key();
    let withdrawal = &mut ctx.accounts.withdrawal;

    withdrawal.stop(stopped_by, now)?;
    ctx.accounts.vault.unreserve(withdrawal.amount_lamports)?;

    emit_cpi!(WithdrawalStopped {
        vault: ctx.accounts.vault.key(),
        withdrawal: ctx.accounts.withdrawal.key(),
        id: ctx.accounts.withdrawal.id,
        stopped_by,
    });

    Ok(())
}
