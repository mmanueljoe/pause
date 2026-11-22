//! US-8, US-8a, US-8b, US-9, US-18: stopping, approving early and releasing a
//! waiting withdrawal, and who or what is refused.

use solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::Signer};

use super::*;
use crate::constants::DAY_SECS;
use crate::errors::PauseError;
use crate::state::WithdrawalStatus;

const SOL: u64 = LAMPORTS_PER_SOL;
const NOW: i64 = 1_800_000_000;

/// Owner with a 5 SOL vault and one waiting withdrawal (id 0) of `sol` SOL to a
/// new address, requested at `NOW` (so it can be released at `NOW + DAY_SECS`).
struct Scene {
    svm: LiteSVM,
    owner: Keypair,
    guardian: Keypair,
    vault: Pubkey,
    recipient: Pubkey,
}

fn scene_with_waiting_withdrawal(sol: u64) -> Scene {
    let mut svm = setup();
    let (owner, guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());
    let recipient = Pubkey::new_unique();
    set_time(&mut svm, NOW);
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, recipient, sol * SOL);
    send(&mut svm, ix, &owner).unwrap();
    Scene {
        svm,
        owner,
        guardian,
        vault,
        recipient,
    }
}

// ---------- Stop ----------

#[test]
fn owner_stops_and_the_money_stays_in_the_vault() {
    let mut s = scene_with_waiting_withdrawal(2);
    let before = lamports_of(&s.svm, &s.vault);

    send(&mut s.svm, stop_ix(&s.owner.pubkey(), s.vault, 0), &s.owner).unwrap();

    let withdrawal = read_withdrawal(&s.svm, &s.vault, 0);
    assert_eq!(
        withdrawal.status,
        WithdrawalStatus::Stopped {
            by: s.owner.pubkey(),
            at: NOW
        }
    );
    assert_eq!(lamports_of(&s.svm, &s.vault), before);
    assert_eq!(lamports_of(&s.svm, &s.recipient), 0);
    assert_eq!(read_vault(&s.svm, &s.owner.pubkey()).reserved_lamports, 0);
}

#[test]
fn guardian_stops_and_the_record_says_who() {
    let mut s = scene_with_waiting_withdrawal(2);

    send(
        &mut s.svm,
        stop_ix(&s.guardian.pubkey(), s.vault, 0),
        &s.guardian,
    )
    .unwrap();

    let withdrawal = read_withdrawal(&s.svm, &s.vault, 0);
    assert_eq!(
        withdrawal.status,
        WithdrawalStatus::Stopped {
            by: s.guardian.pubkey(),
            at: NOW
        }
    );
    assert_eq!(read_vault(&s.svm, &s.owner.pubkey()).reserved_lamports, 0);
}

#[test]
fn stranger_cannot_stop() {
    let mut s = scene_with_waiting_withdrawal(2);
    let stranger = funded_wallet(&mut s.svm);

    let result = send(
        &mut s.svm,
        stop_ix(&stranger.pubkey(), s.vault, 0),
        &stranger,
    );
    assert_pause_error(result, PauseError::NotOwnerOrGuardian);
    assert_eq!(
        read_withdrawal(&s.svm, &s.vault, 0).status,
        WithdrawalStatus::Waiting
    );
}

#[test]
fn stop_still_works_after_the_wait_if_not_yet_released() {
    let mut s = scene_with_waiting_withdrawal(2);
    set_time(&mut s.svm, NOW + DAY_SECS + 300); // the automatic release is 5 minutes late

    send(
        &mut s.svm,
        stop_ix(&s.guardian.pubkey(), s.vault, 0),
        &s.guardian,
    )
    .unwrap();
    assert!(matches!(
        read_withdrawal(&s.svm, &s.vault, 0).status,
        WithdrawalStatus::Stopped { .. }
    ));
}

#[test]
fn a_stopped_withdrawal_cannot_be_stopped_again() {
    let mut s = scene_with_waiting_withdrawal(2);
    send(&mut s.svm, stop_ix(&s.owner.pubkey(), s.vault, 0), &s.owner).unwrap();

    let result = send(
        &mut s.svm,
        stop_ix(&s.guardian.pubkey(), s.vault, 0),
        &s.guardian,
    );
    assert_pause_error(result, PauseError::NotWaiting);
}

// ---------- Approve now ----------

#[test]
fn guardian_approves_and_it_is_sent_immediately() {
    let mut s = scene_with_waiting_withdrawal(2);
    let before = lamports_of(&s.svm, &s.vault);

    let ix = approve_ix(&s.guardian.pubkey(), s.vault, 0, s.recipient);
    send(&mut s.svm, ix, &s.guardian).unwrap();

    assert_eq!(lamports_of(&s.svm, &s.recipient), 2 * SOL);
    assert_eq!(lamports_of(&s.svm, &s.vault), before - 2 * SOL);
    assert_eq!(
        read_withdrawal(&s.svm, &s.vault, 0).status,
        WithdrawalStatus::ApprovedEarly { at: NOW }
    );
    assert_eq!(read_vault(&s.svm, &s.owner.pubkey()).reserved_lamports, 0);
}

#[test]
fn owner_alone_cannot_skip_the_wait() {
    let mut s = scene_with_waiting_withdrawal(2);

    let ix = approve_ix(&s.owner.pubkey(), s.vault, 0, s.recipient);
    assert_pause_error(send(&mut s.svm, ix, &s.owner), PauseError::NotGuardian);
    assert_eq!(lamports_of(&s.svm, &s.recipient), 0);
}

#[test]
fn stranger_cannot_approve() {
    let mut s = scene_with_waiting_withdrawal(2);
    let stranger = funded_wallet(&mut s.svm);

    let ix = approve_ix(&stranger.pubkey(), s.vault, 0, s.recipient);
    assert_pause_error(send(&mut s.svm, ix, &stranger), PauseError::NotGuardian);
    assert_eq!(lamports_of(&s.svm, &s.recipient), 0);
}

#[test]
fn a_stopped_withdrawal_cannot_be_approved() {
    let mut s = scene_with_waiting_withdrawal(2);
    send(&mut s.svm, stop_ix(&s.owner.pubkey(), s.vault, 0), &s.owner).unwrap();

    let ix = approve_ix(&s.guardian.pubkey(), s.vault, 0, s.recipient);
    assert_pause_error(send(&mut s.svm, ix, &s.guardian), PauseError::NotWaiting);
    assert_eq!(lamports_of(&s.svm, &s.recipient), 0);
}

#[test]
fn approve_cannot_send_to_a_different_address() {
    let mut s = scene_with_waiting_withdrawal(2);
    let other = Pubkey::new_unique();

    let ix = approve_ix(&s.guardian.pubkey(), s.vault, 0, other);
    assert_pause_error(
        send(&mut s.svm, ix, &s.guardian),
        PauseError::WrongRecipient,
    );
    assert_eq!(lamports_of(&s.svm, &other), 0);
}

// ---------- Release ----------

#[test]
fn anyone_can_release_after_the_wait() {
    let mut s = scene_with_waiting_withdrawal(2);
    let stranger = funded_wallet(&mut s.svm); // e.g. our backend
    set_time(&mut s.svm, NOW + DAY_SECS);

    send(&mut s.svm, release_ix(s.vault, 0, s.recipient), &stranger).unwrap();

    assert_eq!(lamports_of(&s.svm, &s.recipient), 2 * SOL);
    assert_eq!(
        read_withdrawal(&s.svm, &s.vault, 0).status,
        WithdrawalStatus::Released { at: NOW + DAY_SECS }
    );
    assert_eq!(read_vault(&s.svm, &s.owner.pubkey()).reserved_lamports, 0);
}

#[test]
fn release_before_the_wait_ends_is_refused() {
    let mut s = scene_with_waiting_withdrawal(2);
    set_time(&mut s.svm, NOW + DAY_SECS - 1);

    let result = send(&mut s.svm, release_ix(s.vault, 0, s.recipient), &s.owner);
    assert_pause_error(result, PauseError::TooEarly);
    assert_eq!(lamports_of(&s.svm, &s.recipient), 0);
}

#[test]
fn release_cannot_send_to_a_different_address() {
    let mut s = scene_with_waiting_withdrawal(2);
    let thief = funded_wallet(&mut s.svm);
    let thief_before = lamports_of(&s.svm, &thief.pubkey());
    set_time(&mut s.svm, NOW + DAY_SECS);

    let result = send(&mut s.svm, release_ix(s.vault, 0, thief.pubkey()), &thief);
    assert_pause_error(result, PauseError::WrongRecipient);
    assert!(lamports_of(&s.svm, &thief.pubkey()) <= thief_before);
}

#[test]
fn a_stopped_withdrawal_cannot_be_released() {
    let mut s = scene_with_waiting_withdrawal(2);
    send(
        &mut s.svm,
        stop_ix(&s.guardian.pubkey(), s.vault, 0),
        &s.guardian,
    )
    .unwrap();
    set_time(&mut s.svm, NOW + DAY_SECS);

    let result = send(&mut s.svm, release_ix(s.vault, 0, s.recipient), &s.owner);
    assert_pause_error(result, PauseError::NotWaiting);
    assert_eq!(lamports_of(&s.svm, &s.recipient), 0);
}

#[test]
fn a_withdrawal_cannot_be_paid_twice() {
    let mut s = scene_with_waiting_withdrawal(2);
    set_time(&mut s.svm, NOW + DAY_SECS);
    send(&mut s.svm, release_ix(s.vault, 0, s.recipient), &s.owner).unwrap();

    let again = send(&mut s.svm, release_ix(s.vault, 0, s.recipient), &s.owner);
    assert_pause_error(again, PauseError::NotWaiting);
    let approve = approve_ix(&s.guardian.pubkey(), s.vault, 0, s.recipient);
    assert_pause_error(
        send(&mut s.svm, approve, &s.guardian),
        PauseError::NotWaiting,
    );
    assert_eq!(lamports_of(&s.svm, &s.recipient), 2 * SOL);
}

// ---------- Rescue (US-8b) ----------

#[test]
fn rescue_guardian_approves_everything_to_a_new_wallet() {
    let mut svm = setup();
    let (owner, guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());
    let new_wallet = Pubkey::new_unique();

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, new_wallet, 5 * SOL);
    send(&mut svm, ix, &owner).unwrap();
    send(
        &mut svm,
        approve_ix(&guardian.pubkey(), vault, 0, new_wallet),
        &guardian,
    )
    .unwrap();

    assert_eq!(lamports_of(&svm, &new_wallet), 5 * SOL);
    assert_eq!(vault_balance(&svm, &vault), 0);
}

#[test]
fn rescue_thief_stops_it_and_the_owner_asks_again() {
    let mut svm = setup();
    let (owner, guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());
    let new_wallet = Pubkey::new_unique();

    // The thief has the owner's key, so they can stop the rescue.
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, new_wallet, 5 * SOL);
    send(&mut svm, ix, &owner).unwrap();
    send(&mut svm, stop_ix(&owner.pubkey(), vault, 0), &owner).unwrap();
    assert_eq!(lamports_of(&svm, &new_wallet), 0);

    // Nothing moved, so the owner can ask again and the guardian approves at once.
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 1, new_wallet, 5 * SOL);
    send(&mut svm, ix, &owner).unwrap();
    send(
        &mut svm,
        approve_ix(&guardian.pubkey(), vault, 1, new_wallet),
        &guardian,
    )
    .unwrap();
    assert_eq!(lamports_of(&svm, &new_wallet), 5 * SOL);
}
