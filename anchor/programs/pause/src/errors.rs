//! Every reason the program refuses an action. One error per failure, each with a test.

use anchor_lang::prelude::*;

#[error_code]
pub enum PauseError {
    #[msg("The guardian can't be the owner's own wallet.")]
    GuardianIsOwner,
    #[msg("The guardian address is empty.")]
    GuardianIsEmpty,
    #[msg("The withdrawal wait is shorter than the minimum.")]
    WithdrawalWaitTooShort,
    #[msg("The withdrawal wait is longer than 7 days.")]
    WithdrawalWaitTooLong,
    #[msg("The guardian change wait is shorter than the minimum.")]
    GuardianWaitTooShort,
    #[msg("The guardian change wait is longer than 14 days.")]
    GuardianWaitTooLong,
    // New errors go at the end so existing error codes never change.
    #[msg("The amount must be more than 0.")]
    AmountIsZero,
    #[msg("The amount is below the smallest amount Solana lets a new address hold.")]
    AmountBelowMinimum,
    #[msg("The vault doesn't have enough SOL that isn't already waiting to leave.")]
    NotEnoughInVault,
    #[msg("The recipient address is empty.")]
    RecipientIsEmpty,
    #[msg("A number got too large.")]
    MathOverflow,
}
