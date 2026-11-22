use anchor_lang::prelude::*;

use crate::errors::PauseError;

/// One per withdrawal request. Holds the record only; the SOL stays in the
/// vault until release. Kept after it finishes, so it doubles as history.
/// Address: PDA from `["withdrawal", vault, id]`.
#[account]
#[derive(InitSpace)]
pub struct Withdrawal {
    /// The vault this withdrawal comes from.
    pub vault: Pubkey,
    /// 0, 1, 2… per vault, taken from the vault's counter.
    pub id: u64,
    /// The only address this money can ever go to.
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    /// When it was requested (unix time, seconds).
    pub requested_at: i64,
    /// When it may be released. Fixed at request time, so shortening the
    /// vault's wait later never speeds up a waiting withdrawal.
    pub release_at: i64,
    pub status: WithdrawalStatus,
    /// Saved so the address doesn't need to be recalculated.
    pub bump: u8,
    /// Empty space so fields can be added later without breaking old records.
    pub _reserved: [u8; 32],
}

/// Where a withdrawal is in its life. It starts `Waiting` and moves to
/// exactly one of the other three, never back.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum WithdrawalStatus {
    Waiting,
    /// Stopped by the owner or guardian. The money stays in the vault.
    Stopped {
        by: Pubkey,
        at: i64,
    },
    /// Sent to the recipient after the wait ended.
    Released {
        at: i64,
    },
    /// Sent to the recipient early, approved by the guardian.
    ApprovedEarly {
        at: i64,
    },
}

impl Withdrawal {
    /// Owner or guardian stops it. Allowed until the money has actually left,
    /// even after `release_at` (e.g. if the automatic release is late), so a
    /// guardian can still save money that is still in the vault.
    pub fn stop(&mut self, by: Pubkey, now: i64) -> Result<()> {
        self.status = match self.status {
            WithdrawalStatus::Waiting => WithdrawalStatus::Stopped { by, at: now },
            _ => return err!(PauseError::NotWaiting),
        };
        Ok(())
    }

    /// Guardian approves it early. Allowed any time while it is waiting.
    pub fn approve_early(&mut self, now: i64) -> Result<()> {
        self.status = match self.status {
            WithdrawalStatus::Waiting => WithdrawalStatus::ApprovedEarly { at: now },
            _ => return err!(PauseError::NotWaiting),
        };
        Ok(())
    }

    /// Released after the wait. Only once `release_at` has passed.
    pub fn release(&mut self, now: i64) -> Result<()> {
        self.status = match self.status {
            WithdrawalStatus::Waiting => {
                require!(now >= self.release_at, PauseError::TooEarly);
                WithdrawalStatus::Released { at: now }
            }
            _ => return err!(PauseError::NotWaiting),
        };
        Ok(())
    }
}
