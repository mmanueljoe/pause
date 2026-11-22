//! US-2, US-3, US-19: the owner creates their vault with a guardian.

use anchor_lang::prelude::*;

use crate::constants::VAULT_SEED;
use crate::events::VaultCreated;
use crate::state::Vault;

#[event_cpi]
#[derive(Accounts)]
pub struct CreateVault<'info> {
    /// The owner signs and pays the account's rent.
    #[account(mut)]
    pub owner: Signer<'info>,

    /// `init` fails if this owner already has a vault, so one vault per owner.
    #[account(
        init,
        payer = owner,
        space = Vault::DISCRIMINATOR.len() + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_vault(
    ctx: Context<CreateVault>,
    guardian: Pubkey,
    withdrawal_wait_secs: i64,
    guardian_wait_secs: i64,
) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    Vault::check_guardian(&owner, &guardian)?;
    Vault::check_withdrawal_wait(withdrawal_wait_secs)?;
    Vault::check_guardian_wait(guardian_wait_secs)?;

    ctx.accounts.vault.set_inner(Vault {
        owner,
        guardian: Some(guardian),
        withdrawal_wait_secs,
        guardian_wait_secs,
        reserved_lamports: 0,
        next_withdrawal_id: 0,
        bump: ctx.bumps.vault,
        _reserved: [0; 64],
        pending_change: None,
    });

    emit_cpi!(VaultCreated {
        vault: ctx.accounts.vault.key(),
        owner,
        guardian,
        withdrawal_wait_secs,
        guardian_wait_secs,
    });

    Ok(())
}
