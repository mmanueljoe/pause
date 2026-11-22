//! US-10, US-11: anyone makes the waiting change real once its wait has ended.
//! Our backend does this automatically. No signer is checked: the change
//! itself was chosen by the owner and had its full wait.

use anchor_lang::prelude::*;

use crate::constants::VAULT_SEED;
use crate::events::ChangeApplied;
use crate::state::Vault;

#[event_cpi]
#[derive(Accounts)]
pub struct ApplyChange<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handle_apply_change(ctx: Context<ApplyChange>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let change = ctx.accounts.vault.apply_pending_change(now)?;

    emit_cpi!(ChangeApplied {
        vault: ctx.accounts.vault.key(),
        kind: change.kind,
    });

    Ok(())
}
