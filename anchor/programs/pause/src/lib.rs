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

    /// Owner moves SOL from their wallet into their vault. Instant.
    pub fn deposit(ctx: Context<Deposit>, amount_lamports: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount_lamports)
    }

    /// Owner asks to send SOL to `recipient`. Nothing moves yet: every
    /// withdrawal waits the vault's withdrawal wait (core rule 1).
    pub fn request_withdrawal(
        ctx: Context<RequestWithdrawal>,
        recipient: Pubkey,
        amount_lamports: u64,
    ) -> Result<()> {
        instructions::request_withdrawal::handle_request_withdrawal(ctx, recipient, amount_lamports)
    }

    /// Owner or guardian stops a waiting withdrawal. The money stays in the vault.
    pub fn stop_withdrawal(ctx: Context<StopWithdrawal>) -> Result<()> {
        instructions::stop_withdrawal::handle_stop_withdrawal(ctx)
    }

    /// Guardian approves a waiting withdrawal early; it is sent immediately.
    /// Only the guardian can skip the wait (core rule 4).
    pub fn approve_withdrawal(ctx: Context<ApproveWithdrawal>) -> Result<()> {
        instructions::approve_withdrawal::handle_approve_withdrawal(ctx)
    }

    /// Anyone sends a withdrawal to its named recipient once the wait has ended
    /// (core rule 6). This is how the backend releases automatically.
    pub fn release_withdrawal(ctx: Context<ReleaseWithdrawal>) -> Result<()> {
        instructions::release_withdrawal::handle_release_withdrawal(ctx)
    }

    /// Owner changes the withdrawal wait. Longer applies at once; shorter
    /// waits the guardian wait and can be cancelled (core rules 8, 9, 11).
    pub fn change_withdrawal_wait(
        ctx: Context<ChangeWithdrawalWait>,
        new_wait_secs: i64,
    ) -> Result<()> {
        instructions::change_withdrawal_wait::handle_change_withdrawal_wait(ctx, new_wait_secs)
    }

    /// Owner proposes a new guardian (`Some`) or removing the guardian (`None`).
    /// Always waits, including adding one to a vault without one (core rule 10).
    pub fn propose_guardian_change(
        ctx: Context<ProposeGuardianChange>,
        new_guardian: Option<Pubkey>,
    ) -> Result<()> {
        instructions::propose_guardian_change::handle_propose_guardian_change(ctx, new_guardian)
    }

    /// Anyone makes the waiting change real once its wait has ended.
    pub fn apply_change(ctx: Context<ApplyChange>) -> Result<()> {
        instructions::apply_change::handle_apply_change(ctx)
    }

    /// Owner or current guardian cancels the waiting change.
    pub fn cancel_change(ctx: Context<CancelChange>) -> Result<()> {
        instructions::cancel_change::handle_cancel_change(ctx)
    }
}
