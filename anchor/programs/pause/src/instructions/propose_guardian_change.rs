//! US-10, US-16, US-19: the owner proposes a new guardian, removing the
//! guardian, or adding one to a vault without one. Always waits.

use anchor_lang::prelude::*;

use crate::constants::VAULT_SEED;
use crate::errors::PauseError;
use crate::events::ChangeProposed;
use crate::state::{ChangeKind, Vault};

#[event_cpi]
#[derive(Accounts)]
pub struct ProposeGuardianChange<'info> {
    pub owner: Signer<'info>,

    /// Built from the signer's wallet, so only the owner can change settings.
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handle_propose_guardian_change(
    ctx: Context<ProposeGuardianChange>,
    new_guardian: Option<Pubkey>,
) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;

    match new_guardian {
        Some(guardian) => {
            Vault::check_guardian(&owner, &guardian)?;
            require!(!vault.is_guardian(&guardian), PauseError::NoChange);
        }
        None => require!(vault.guardian.is_some(), PauseError::NoGuardianToRemove),
    }

    let now = Clock::get()?.unix_timestamp;
    let change = vault.propose_change(ChangeKind::Guardian { new_guardian }, now)?;

    emit_cpi!(ChangeProposed {
        vault: vault_key,
        kind: change.kind,
        apply_after: change.apply_after,
    });

    Ok(())
}
