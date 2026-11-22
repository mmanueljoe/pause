//! US-9: anyone sends a withdrawal to its named recipient once the wait has
//! ended. Our backend does this automatically; the owner can do it by hand.
//! No signer is checked: the money can only ever go to the named recipient.

use anchor_lang::prelude::*;

use crate::constants::{VAULT_SEED, WITHDRAWAL_SEED};
use crate::errors::PauseError;
use crate::events::WithdrawalReleased;
use crate::state::{Vault, Withdrawal};

#[event_cpi]
#[derive(Accounts)]
pub struct ReleaseWithdrawal<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
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

pub fn handle_release_withdrawal(ctx: Context<ReleaseWithdrawal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let amount_lamports = ctx.accounts.withdrawal.amount_lamports;

    ctx.accounts.withdrawal.release(now)?;
    Vault::pay_out(
        &mut ctx.accounts.vault,
        &ctx.accounts.recipient.to_account_info(),
        amount_lamports,
    )?;

    emit_cpi!(WithdrawalReleased {
        vault: ctx.accounts.vault.key(),
        withdrawal: ctx.accounts.withdrawal.key(),
        id: ctx.accounts.withdrawal.id,
        recipient: ctx.accounts.recipient.key(),
        amount_lamports,
    });

    Ok(())
}
