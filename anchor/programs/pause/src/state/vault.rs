use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::PauseError;

/// One per owner. Holds the vault's settings and the SOL itself.
/// Address: PDA from `["vault", owner]`.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    /// The owner's wallet. Only this wallet can deposit, withdraw or change settings.
    pub owner: Pubkey,
    /// Can stop or approve early, never spend. `None` only after the owner removes them.
    pub guardian: Option<Pubkey>,
    /// How long every withdrawal waits.
    pub withdrawal_wait_secs: i64,
    /// How long less-safe changes wait (guardian change, shorter withdrawal wait).
    pub guardian_wait_secs: i64,
    /// SOL promised to withdrawals that are still waiting.
    pub reserved_lamports: u64,
    /// Counter that gives each withdrawal its own address.
    pub next_withdrawal_id: u64,
    /// Saved so the address doesn't need to be recalculated.
    pub bump: u8,
    /// Empty space so fields can be added later without breaking existing vaults.
    pub _reserved: [u8; 64],
}

impl Vault {
    /// A guardian must be a real wallet that isn't the owner's.
    pub fn check_guardian(owner: &Pubkey, guardian: &Pubkey) -> Result<()> {
        require!(*guardian != Pubkey::default(), PauseError::GuardianIsEmpty);
        require!(guardian != owner, PauseError::GuardianIsOwner);
        Ok(())
    }

    pub fn check_withdrawal_wait(secs: i64) -> Result<()> {
        require!(
            secs >= MIN_WITHDRAWAL_WAIT_SECS,
            PauseError::WithdrawalWaitTooShort
        );
        require!(
            secs <= MAX_WITHDRAWAL_WAIT_SECS,
            PauseError::WithdrawalWaitTooLong
        );
        Ok(())
    }

    pub fn check_guardian_wait(secs: i64) -> Result<()> {
        require!(
            secs >= MIN_GUARDIAN_WAIT_SECS,
            PauseError::GuardianWaitTooShort
        );
        require!(
            secs <= MAX_GUARDIAN_WAIT_SECS,
            PauseError::GuardianWaitTooLong
        );
        Ok(())
    }
}
