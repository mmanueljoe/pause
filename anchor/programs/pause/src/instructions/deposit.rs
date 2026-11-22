//! US-4: the owner moves SOL from their wallet into their vault. Instant.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::VAULT_SEED;
use crate::errors::PauseError;
use crate::events::Deposited;
use crate::state::Vault;

#[event_cpi]
#[derive(Accounts)]
pub struct Deposit<'info> {
    /// The owner signs, and the SOL comes from their wallet.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The vault's address is built from the signer's wallet, so it can only
    /// be the signer's own vault. Anyone else (the guardian, a stranger) is
    /// refused here with a seeds error.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount_lamports: u64) -> Result<()> {
    require!(amount_lamports > 0, PauseError::AmountIsZero);

    // Ask the System Program to move the SOL from the owner's wallet into the vault.
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount_lamports,
    )?;

    emit_cpi!(Deposited {
        vault: ctx.accounts.vault.key(),
        owner: ctx.accounts.owner.key(),
        amount_lamports,
        balance_lamports: Vault::balance_lamports(&ctx.accounts.vault.to_account_info())?,
    });

    Ok(())
}
