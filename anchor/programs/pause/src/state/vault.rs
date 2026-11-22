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
    /// A less-safe change that is waiting, if any. One at a time.
    /// Last because its size varies (None is smaller than Some).
    pub pending_change: Option<PendingChange>,
}

/// A less-safe settings change that waits `guardian_wait_secs` before it can
/// be applied, so the guardian has time to cancel it.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub struct PendingChange {
    pub kind: ChangeKind,
    pub proposed_at: i64,
    /// Earliest time `apply_change` can make it real.
    pub apply_after: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ChangeKind {
    /// `Some` = change to (or add) this guardian, `None` = remove the guardian.
    Guardian { new_guardian: Option<Pubkey> },
    /// A shorter withdrawal wait (longer ones apply at once).
    WithdrawalWait { new_wait_secs: i64 },
}

impl Vault {
    /// The owner's money in the vault: all its SOL except the rent minimum
    /// Solana requires the account to keep. Not stored as a field, so it can
    /// never drift from the real SOL balance.
    pub fn balance_lamports(vault: &AccountInfo) -> Result<u64> {
        let rent_minimum = Rent::get()?.minimum_balance(vault.data_len());
        Ok(vault.lamports().saturating_sub(rent_minimum))
    }

    /// Whether `who` is the vault's current guardian.
    pub fn is_guardian(&self, who: &Pubkey) -> bool {
        self.guardian.as_ref() == Some(who)
    }

    /// Frees SOL that was promised to a withdrawal that is no longer waiting.
    pub fn unreserve(&mut self, amount_lamports: u64) -> Result<()> {
        self.reserved_lamports = self
            .reserved_lamports
            .checked_sub(amount_lamports)
            .ok_or(PauseError::MathOverflow)?;
        Ok(())
    }

    /// Sends a waiting withdrawal's SOL from the vault to its recipient.
    /// The only code that moves SOL out of a vault.
    ///
    /// The vault is owned by this program, so the program lowers its lamports
    /// directly (the System Program can only move SOL out of plain wallets).
    pub fn pay_out(
        vault: &mut Account<Vault>,
        recipient: &AccountInfo,
        amount_lamports: u64,
    ) -> Result<()> {
        vault.unreserve(amount_lamports)?;
        let vault_info = vault.to_account_info();
        vault_info.sub_lamports(amount_lamports)?;
        recipient.add_lamports(amount_lamports)?;

        // Safety rule: the vault must still cover everything it has promised.
        require!(
            Vault::balance_lamports(&vault_info)? >= vault.reserved_lamports,
            PauseError::VaultInvariantBroken
        );
        Ok(())
    }

    /// Starts waiting on a less-safe change. Refused if one is already waiting.
    pub fn propose_change(&mut self, kind: ChangeKind, now: i64) -> Result<PendingChange> {
        require!(self.pending_change.is_none(), PauseError::ChangePending);
        let change = PendingChange {
            kind,
            proposed_at: now,
            apply_after: now
                .checked_add(self.guardian_wait_secs)
                .ok_or(PauseError::MathOverflow)?,
        };
        self.pending_change = Some(change);
        Ok(change)
    }

    /// Makes the waiting change real, once its wait has ended.
    pub fn apply_pending_change(&mut self, now: i64) -> Result<PendingChange> {
        let change = self.pending_change.ok_or(PauseError::NoPendingChange)?;
        require!(now >= change.apply_after, PauseError::TooEarly);
        match change.kind {
            ChangeKind::Guardian { new_guardian } => self.guardian = new_guardian,
            ChangeKind::WithdrawalWait { new_wait_secs } => {
                self.withdrawal_wait_secs = new_wait_secs;
            }
        }
        self.pending_change = None;
        Ok(change)
    }

    /// Drops the waiting change without applying it.
    pub fn cancel_pending_change(&mut self) -> Result<PendingChange> {
        let change = self.pending_change.ok_or(PauseError::NoPendingChange)?;
        self.pending_change = None;
        Ok(change)
    }

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
