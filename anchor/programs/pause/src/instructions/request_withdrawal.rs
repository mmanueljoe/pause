//! US-5, US-15: the owner asks to send SOL from the vault. Nothing moves
//! yet: the withdrawal waits, so the owner or guardian can stop it.

use anchor_lang::prelude::*;

use crate::constants::{VAULT_SEED, WITHDRAWAL_SEED};
use crate::errors::PauseError;
use crate::events::WithdrawalRequested;
use crate::state::{Vault, Withdrawal, WithdrawalStatus};

#[event_cpi]
#[derive(Accounts)]
pub struct RequestWithdrawal<'info> {
    /// The owner signs and pays the withdrawal record's rent.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// Built from the signer's wallet, so only the owner can request.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    /// A new record at the vault's next id, so several can wait at once.
    #[account(
        init,
        payer = owner,
        space = Withdrawal::DISCRIMINATOR.len() + Withdrawal::INIT_SPACE,
        seeds = [
            WITHDRAWAL_SEED,
            vault.key().as_ref(),
            &vault.next_withdrawal_id.to_le_bytes(),
        ],
        bump,
    )]
    pub withdrawal: Account<'info, Withdrawal>,

    pub system_program: Program<'info, System>,
}

pub fn handle_request_withdrawal(
    ctx: Context<RequestWithdrawal>,
    recipient: Pubkey,
    amount_lamports: u64,
) -> Result<()> {
    require!(recipient != Pubkey::default(), PauseError::RecipientIsEmpty);
    require!(amount_lamports > 0, PauseError::AmountIsZero);
    // A brand-new address must receive at least this much, or the release
    // could never go through.
    require!(
        amount_lamports >= Rent::get()?.minimum_balance(0),
        PauseError::AmountBelowMinimum
    );

    let vault_info = ctx.accounts.vault.to_account_info();
    let vault = &mut ctx.accounts.vault;

    // Only SOL not already promised to other waiting withdrawals can be requested.
    let available = Vault::balance_lamports(&vault_info)?.saturating_sub(vault.reserved_lamports);
    require!(amount_lamports <= available, PauseError::NotEnoughInVault);

    let now = Clock::get()?.unix_timestamp;
    let release_at = now
        .checked_add(vault.withdrawal_wait_secs)
        .ok_or(PauseError::MathOverflow)?;
    let id = vault.next_withdrawal_id;

    vault.reserved_lamports = vault
        .reserved_lamports
        .checked_add(amount_lamports)
        .ok_or(PauseError::MathOverflow)?;
    vault.next_withdrawal_id = id.checked_add(1).ok_or(PauseError::MathOverflow)?;

    ctx.accounts.withdrawal.set_inner(Withdrawal {
        vault: vault.key(),
        id,
        recipient,
        amount_lamports,
        requested_at: now,
        release_at,
        status: WithdrawalStatus::Waiting,
        bump: ctx.bumps.withdrawal,
        _reserved: [0; 32],
    });

    emit_cpi!(WithdrawalRequested {
        vault: ctx.accounts.vault.key(),
        withdrawal: ctx.accounts.withdrawal.key(),
        id,
        recipient,
        amount_lamports,
        release_at,
    });

    Ok(())
}
