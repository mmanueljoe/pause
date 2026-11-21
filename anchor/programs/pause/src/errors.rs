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
}
