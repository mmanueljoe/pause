//! US-10, US-11, US-16, US-17, US-19: changing the wait time and the guardian,
//! and who or what is refused.

use anchor_lang::error::ErrorCode as AnchorError;
use solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::Signer};

use super::*;
use crate::constants::{DAY_SECS, HOUR_SECS, MIN_WITHDRAWAL_WAIT_SECS};
use crate::errors::PauseError;
use crate::state::{ChangeKind, PendingChange, WithdrawalStatus};

const SOL: u64 = LAMPORTS_PER_SOL;
const NOW: i64 = 1_800_000_000;
/// The guardian wait used by `owner_with_vault`.
const GUARDIAN_WAIT: i64 = 3 * DAY_SECS;

/// Owner with a 5 SOL vault (24h withdrawal wait, 3-day guardian wait), at `NOW`.
fn scene() -> (LiteSVM, Keypair, Keypair, Pubkey) {
    let mut svm = setup();
    let (owner, guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());
    set_time(&mut svm, NOW);
    (svm, owner, guardian, vault)
}

/// Proposes `new_guardian`, waits the guardian wait, then applies it.
fn change_guardian_now(svm: &mut LiteSVM, owner: &Keypair, new_guardian: Option<Pubkey>) {
    let vault = vault_address(&owner.pubkey());
    send(
        svm,
        propose_guardian_ix(&owner.pubkey(), vault, new_guardian),
        owner,
    )
    .unwrap();
    let apply_after = read_vault(svm, &owner.pubkey())
        .pending_change
        .unwrap()
        .apply_after;
    set_time(svm, apply_after);
    send(svm, apply_change_ix(vault), owner).unwrap();
}

// ---------- Withdrawal wait ----------

#[test]
fn longer_wait_applies_at_once() {
    let (mut svm, owner, _guardian, vault) = scene();

    send(
        &mut svm,
        change_wait_ix(&owner.pubkey(), vault, 2 * DAY_SECS),
        &owner,
    )
    .unwrap();

    let state = read_vault(&svm, &owner.pubkey());
    assert_eq!(state.withdrawal_wait_secs, 2 * DAY_SECS);
    assert_eq!(state.pending_change, None);
}

#[test]
fn shorter_wait_waits_then_applies() {
    let (mut svm, owner, _guardian, vault) = scene();

    send(
        &mut svm,
        change_wait_ix(&owner.pubkey(), vault, HOUR_SECS),
        &owner,
    )
    .unwrap();

    let state = read_vault(&svm, &owner.pubkey());
    assert_eq!(state.withdrawal_wait_secs, DAY_SECS, "not applied yet");
    assert_eq!(
        state.pending_change,
        Some(PendingChange {
            kind: ChangeKind::WithdrawalWait {
                new_wait_secs: HOUR_SECS
            },
            proposed_at: NOW,
            apply_after: NOW + GUARDIAN_WAIT,
        })
    );

    set_time(&mut svm, NOW + GUARDIAN_WAIT - 1);
    assert_pause_error(
        send(&mut svm, apply_change_ix(vault), &owner),
        PauseError::TooEarly,
    );

    set_time(&mut svm, NOW + GUARDIAN_WAIT);
    send(&mut svm, apply_change_ix(vault), &owner).unwrap();
    let state = read_vault(&svm, &owner.pubkey());
    assert_eq!(state.withdrawal_wait_secs, HOUR_SECS);
    assert_eq!(state.pending_change, None);
}

#[test]
fn shorter_wait_does_not_speed_up_a_waiting_withdrawal() {
    let (mut svm, owner, _guardian, vault) = scene();
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), SOL);
    send(&mut svm, ix, &owner).unwrap();

    send(
        &mut svm,
        change_wait_ix(&owner.pubkey(), vault, HOUR_SECS),
        &owner,
    )
    .unwrap();
    set_time(&mut svm, NOW + GUARDIAN_WAIT);
    send(&mut svm, apply_change_ix(vault), &owner).unwrap();

    assert_eq!(read_withdrawal(&svm, &vault, 0).release_at, NOW + DAY_SECS);
}

#[test]
fn same_wait_is_refused() {
    let (mut svm, owner, _guardian, vault) = scene();
    let result = send(
        &mut svm,
        change_wait_ix(&owner.pubkey(), vault, DAY_SECS),
        &owner,
    );
    assert_pause_error(result, PauseError::NoChange);
}

#[test]
fn wait_out_of_range_is_refused() {
    let (mut svm, owner, _guardian, vault) = scene();
    let ix = change_wait_ix(&owner.pubkey(), vault, MIN_WITHDRAWAL_WAIT_SECS - 1);
    assert_pause_error(
        send(&mut svm, ix, &owner),
        PauseError::WithdrawalWaitTooShort,
    );
}

#[test]
fn guardian_and_stranger_cannot_change_the_wait() {
    let (mut svm, _owner, guardian, vault) = scene();
    let stranger = funded_wallet(&mut svm);

    let ix = change_wait_ix(&guardian.pubkey(), vault, HOUR_SECS);
    assert_anchor_error(send(&mut svm, ix, &guardian), AnchorError::ConstraintSeeds);
    let ix = change_wait_ix(&stranger.pubkey(), vault, HOUR_SECS);
    assert_anchor_error(send(&mut svm, ix, &stranger), AnchorError::ConstraintSeeds);
}

// ---------- Guardian change and removal ----------

#[test]
fn guardian_change_waits_then_the_new_guardian_takes_over() {
    let (mut svm, owner, old_guardian, vault) = scene();
    let new_guardian = funded_wallet(&mut svm);

    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(new_guardian.pubkey()));
    send(&mut svm, ix, &owner).unwrap();
    assert_eq!(
        read_vault(&svm, &owner.pubkey()).guardian,
        Some(old_guardian.pubkey())
    );

    set_time(&mut svm, NOW + GUARDIAN_WAIT - 1);
    assert_pause_error(
        send(&mut svm, apply_change_ix(vault), &owner),
        PauseError::TooEarly,
    );

    // Anyone can apply once the wait ends (e.g. our backend).
    let stranger = funded_wallet(&mut svm);
    set_time(&mut svm, NOW + GUARDIAN_WAIT);
    send(&mut svm, apply_change_ix(vault), &stranger).unwrap();
    assert_eq!(
        read_vault(&svm, &owner.pubkey()).guardian,
        Some(new_guardian.pubkey())
    );

    // The old guardian can no longer stop; the new one can.
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), SOL);
    send(&mut svm, ix, &owner).unwrap();
    let result = send(
        &mut svm,
        stop_ix(&old_guardian.pubkey(), vault, 0),
        &old_guardian,
    );
    assert_pause_error(result, PauseError::NotOwnerOrGuardian);
    send(
        &mut svm,
        stop_ix(&new_guardian.pubkey(), vault, 0),
        &new_guardian,
    )
    .unwrap();
}

#[test]
fn after_removal_the_old_guardian_cannot_approve() {
    let (mut svm, owner, old_guardian, vault) = scene();
    change_guardian_now(&mut svm, &owner, None);
    assert_eq!(read_vault(&svm, &owner.pubkey()).guardian, None);

    let recipient = Pubkey::new_unique();
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, recipient, SOL);
    send(&mut svm, ix, &owner).unwrap();

    let ix = approve_ix(&old_guardian.pubkey(), vault, 0, recipient);
    assert_pause_error(send(&mut svm, ix, &old_guardian), PauseError::NotGuardian);
    // Withdrawals still wait.
    assert_eq!(
        read_withdrawal(&svm, &vault, 0).status,
        WithdrawalStatus::Waiting
    );
}

#[test]
fn adding_a_guardian_to_a_vault_without_one_waits() {
    let (mut svm, owner, _guardian, vault) = scene();
    change_guardian_now(&mut svm, &owner, None);

    let thief_guardian = funded_wallet(&mut svm);
    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(thief_guardian.pubkey()));
    send(&mut svm, ix, &owner).unwrap();

    // Not a guardian yet, so they can't use Approve now to empty the vault.
    assert_eq!(read_vault(&svm, &owner.pubkey()).guardian, None);
    let recipient = Pubkey::new_unique();
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, recipient, SOL);
    send(&mut svm, ix, &owner).unwrap();
    let ix = approve_ix(&thief_guardian.pubkey(), vault, 0, recipient);
    assert_pause_error(send(&mut svm, ix, &thief_guardian), PauseError::NotGuardian);
}

#[test]
fn guardian_cancels_a_thiefs_guardian_swap() {
    let (mut svm, owner, guardian, vault) = scene();
    let thief = funded_wallet(&mut svm);

    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(thief.pubkey()));
    send(&mut svm, ix, &owner).unwrap();
    send(
        &mut svm,
        cancel_change_ix(&guardian.pubkey(), vault),
        &guardian,
    )
    .unwrap();

    let state = read_vault(&svm, &owner.pubkey());
    assert_eq!(state.pending_change, None);
    assert_eq!(state.guardian, Some(guardian.pubkey()));

    set_time(&mut svm, NOW + GUARDIAN_WAIT);
    assert_pause_error(
        send(&mut svm, apply_change_ix(vault), &owner),
        PauseError::NoPendingChange,
    );
}

#[test]
fn owner_cancels_their_own_change() {
    let (mut svm, owner, _guardian, vault) = scene();
    send(
        &mut svm,
        change_wait_ix(&owner.pubkey(), vault, HOUR_SECS),
        &owner,
    )
    .unwrap();

    send(&mut svm, cancel_change_ix(&owner.pubkey(), vault), &owner).unwrap();
    assert_eq!(read_vault(&svm, &owner.pubkey()).pending_change, None);
}

#[test]
fn stranger_and_proposed_guardian_cannot_cancel() {
    let (mut svm, owner, _guardian, vault) = scene();
    let proposed = funded_wallet(&mut svm);
    let stranger = funded_wallet(&mut svm);
    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(proposed.pubkey()));
    send(&mut svm, ix, &owner).unwrap();

    let result = send(
        &mut svm,
        cancel_change_ix(&stranger.pubkey(), vault),
        &stranger,
    );
    assert_pause_error(result, PauseError::NotOwnerOrGuardian);
    let result = send(
        &mut svm,
        cancel_change_ix(&proposed.pubkey(), vault),
        &proposed,
    );
    assert_pause_error(result, PauseError::NotOwnerOrGuardian);
    assert!(read_vault(&svm, &owner.pubkey()).pending_change.is_some());
}

#[test]
fn only_one_change_can_wait_at_a_time() {
    let (mut svm, owner, _guardian, vault) = scene();
    send(
        &mut svm,
        change_wait_ix(&owner.pubkey(), vault, HOUR_SECS),
        &owner,
    )
    .unwrap();

    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(Pubkey::new_unique()));
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::ChangePending);
    let ix = change_wait_ix(&owner.pubkey(), vault, 2 * HOUR_SECS);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::ChangePending);
}

#[test]
fn apply_with_nothing_waiting_is_refused() {
    let (mut svm, owner, _guardian, vault) = scene();
    assert_pause_error(
        send(&mut svm, apply_change_ix(vault), &owner),
        PauseError::NoPendingChange,
    );
}

#[test]
fn new_guardian_cannot_be_the_owner_or_empty() {
    let (mut svm, owner, _guardian, vault) = scene();

    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(owner.pubkey()));
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::GuardianIsOwner);
    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(Pubkey::default()));
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::GuardianIsEmpty);
}

#[test]
fn proposing_the_current_guardian_is_refused() {
    let (mut svm, owner, guardian, vault) = scene();
    let ix = propose_guardian_ix(&owner.pubkey(), vault, Some(guardian.pubkey()));
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::NoChange);
}

#[test]
fn removing_when_there_is_no_guardian_is_refused() {
    let (mut svm, owner, _guardian, vault) = scene();
    change_guardian_now(&mut svm, &owner, None);

    let ix = propose_guardian_ix(&owner.pubkey(), vault, None);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::NoGuardianToRemove);
}

#[test]
fn guardian_and_stranger_cannot_propose_a_guardian_change() {
    let (mut svm, _owner, guardian, vault) = scene();
    let stranger = funded_wallet(&mut svm);

    let ix = propose_guardian_ix(&guardian.pubkey(), vault, Some(stranger.pubkey()));
    assert_anchor_error(send(&mut svm, ix, &guardian), AnchorError::ConstraintSeeds);
    let ix = propose_guardian_ix(&stranger.pubkey(), vault, Some(stranger.pubkey()));
    assert_anchor_error(send(&mut svm, ix, &stranger), AnchorError::ConstraintSeeds);
}
