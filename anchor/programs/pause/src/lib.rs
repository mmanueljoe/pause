//! Pause: a vault where every withdrawal waits, so the owner or a trusted
//! guardian can stop it.
//!
//! The rules live here, in the program, never only in the website.
//! See `docs/requirements.md` ("Core rules" and "Solana program actions").
//! Actions are added one user story at a time, each with tests for who is
//! refused and when.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(test)]
mod tests;

declare_id!("BUFdujWydbi7UA13x1EnBavq7iwNjaxip5Csuv9fjEDz");

#[program]
pub mod pause {
    use super::*;

    /// Owner creates their vault with a guardian and both wait times.
    /// A vault can't exist without a guardian (core rule 10).
    pub fn create_vault(
        ctx: Context<CreateVault>,
        guardian: Pubkey,
        withdrawal_wait_secs: i64,
        guardian_wait_secs: i64,
    ) -> Result<()> {
        instructions::create_vault::handle_create_vault(
            ctx,
            guardian,
            withdrawal_wait_secs,
            guardian_wait_secs,
        )
    }
}
