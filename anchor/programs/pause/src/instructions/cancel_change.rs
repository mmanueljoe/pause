//! US-10, US-16, US-17: the owner or the current guardian cancels the
//! waiting change, e.g. a thief trying to swap the guardian.

use anchor_lang::prelude::*;

use crate::constants::VAULT_SEED;
use crate::errors::PauseError;
use crate::events::ChangeCancelled;
use crate::state::Vault;

#[event_cpi]
#[derive(Accounts)]
pub struct CancelChange<'info> {
    /// The owner or the current guardian (not a proposed new one).
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
        constraint = authority.key() == vault.owner || vault.is_guardian(&authority.key())
            @ PauseError::NotOwnerOrGuardian,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handle_cancel_change(ctx: Context<CancelChange>) -> Result<()> {
    let change = ctx.accounts.vault.cancel_pending_change()?;

    emit_cpi!(ChangeCancelled {
        vault: ctx.accounts.vault.key(),
        kind: change.kind,
        cancelled_by: ctx.accounts.authority.key(),
    });

    Ok(())
}
