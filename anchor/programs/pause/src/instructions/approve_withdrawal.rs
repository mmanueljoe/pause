//! US-8a, US-8b: the guardian approves a waiting withdrawal early, and it is
//! sent immediately. Only the guardian can skip the wait.

use anchor_lang::prelude::*;

use crate::constants::{VAULT_SEED, WITHDRAWAL_SEED};
use crate::errors::PauseError;
use crate::events::WithdrawalApproved;
use crate::state::{Vault, Withdrawal};

#[event_cpi]
#[derive(Accounts)]
pub struct ApproveWithdrawal<'info> {
    pub guardian: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.is_guardian(&guardian.key()) @ PauseError::NotGuardian,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [WITHDRAWAL_SEED, vault.key().as_ref(), &withdrawal.id.to_le_bytes()],
        bump = withdrawal.bump,
    )]
    pub withdrawal: Account<'info, Withdrawal>,

    /// CHECK: any address can receive SOL; it must be the one named in the withdrawal.
    #[account(mut, address = withdrawal.recipient @ PauseError::WrongRecipient)]
    pub recipient: UncheckedAccount<'info>,
}

pub fn handle_approve_withdrawal(ctx: Context<ApproveWithdrawal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let amount_lamports = ctx.accounts.withdrawal.amount_lamports;

    ctx.accounts.withdrawal.approve_early(now)?;
    Vault::pay_out(
        &mut ctx.accounts.vault,
        &ctx.accounts.recipient.to_account_info(),
        amount_lamports,
    )?;

    emit_cpi!(WithdrawalApproved {
        vault: ctx.accounts.vault.key(),
        withdrawal: ctx.accounts.withdrawal.key(),
        id: ctx.accounts.withdrawal.id,
        guardian: ctx.accounts.guardian.key(),
        recipient: ctx.accounts.recipient.key(),
        amount_lamports,
    });

    Ok(())
}
