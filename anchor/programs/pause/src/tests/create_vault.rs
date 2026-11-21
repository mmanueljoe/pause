//! US-2, US-3, US-19: creating a vault, and who or what is refused.

use solana_sdk::{pubkey::Pubkey, signer::Signer};

use super::*;
use crate::constants::*;
use crate::errors::PauseError;

const DAY: i64 = DAY_SECS;

#[test]
fn owner_creates_vault_with_guardian() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);
    let guardian = Pubkey::new_unique();

    let ix = create_vault_ix(&owner.pubkey(), guardian, DAY, 3 * DAY);
    send(&mut svm, ix, &owner).unwrap();

    let vault = read_vault(&svm, &owner.pubkey());
    assert_eq!(vault.owner, owner.pubkey());
    assert_eq!(vault.guardian, Some(guardian));
    assert_eq!(vault.withdrawal_wait_secs, DAY);
    assert_eq!(vault.guardian_wait_secs, 3 * DAY);
    assert_eq!(vault.reserved_lamports, 0);
    assert_eq!(vault.next_withdrawal_id, 0);
}

#[test]
fn shortest_and_longest_waits_are_accepted() {
    let mut svm = setup();

    let owner = funded_wallet(&mut svm);
    let ix = create_vault_ix(
        &owner.pubkey(),
        Pubkey::new_unique(),
        MIN_WITHDRAWAL_WAIT_SECS,
        MIN_GUARDIAN_WAIT_SECS,
    );
    send(&mut svm, ix, &owner).unwrap();

    let owner = funded_wallet(&mut svm);
    let ix = create_vault_ix(
        &owner.pubkey(),
        Pubkey::new_unique(),
        MAX_WITHDRAWAL_WAIT_SECS,
        MAX_GUARDIAN_WAIT_SECS,
    );
    send(&mut svm, ix, &owner).unwrap();
}

#[test]
fn owner_cannot_be_their_own_guardian() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = create_vault_ix(&owner.pubkey(), owner.pubkey(), DAY, 3 * DAY);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::GuardianIsOwner);
}

#[test]
fn vault_cannot_be_created_without_a_guardian() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = create_vault_ix(&owner.pubkey(), Pubkey::default(), DAY, 3 * DAY);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::GuardianIsEmpty);
}

#[test]
fn withdrawal_wait_below_minimum_is_refused() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = create_vault_ix(
        &owner.pubkey(),
        Pubkey::new_unique(),
        MIN_WITHDRAWAL_WAIT_SECS - 1,
        3 * DAY,
    );
    assert_pause_error(
        send(&mut svm, ix, &owner),
        PauseError::WithdrawalWaitTooShort,
    );
}

#[test]
fn withdrawal_wait_above_7_days_is_refused() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = create_vault_ix(
        &owner.pubkey(),
        Pubkey::new_unique(),
        MAX_WITHDRAWAL_WAIT_SECS + 1,
        3 * DAY,
    );
    assert_pause_error(
        send(&mut svm, ix, &owner),
        PauseError::WithdrawalWaitTooLong,
    );
}

#[test]
fn guardian_wait_below_minimum_is_refused() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = create_vault_ix(
        &owner.pubkey(),
        Pubkey::new_unique(),
        DAY,
        MIN_GUARDIAN_WAIT_SECS - 1,
    );
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::GuardianWaitTooShort);
}

#[test]
fn guardian_wait_above_14_days_is_refused() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = create_vault_ix(
        &owner.pubkey(),
        Pubkey::new_unique(),
        DAY,
        MAX_GUARDIAN_WAIT_SECS + 1,
    );
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::GuardianWaitTooLong);
}

#[test]
fn owner_cannot_create_a_second_vault() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let first = create_vault_ix(&owner.pubkey(), Pubkey::new_unique(), DAY, 3 * DAY);
    send(&mut svm, first, &owner).unwrap();

    let second = create_vault_ix(&owner.pubkey(), Pubkey::new_unique(), DAY, 3 * DAY);
    assert!(send(&mut svm, second, &owner).is_err());

    // The first vault is unchanged.
    let vault = read_vault(&svm, &owner.pubkey());
    assert_eq!(vault.withdrawal_wait_secs, DAY);
}

#[test]
fn someone_else_cannot_create_a_vault_for_the_owner() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);
    let stranger = funded_wallet(&mut svm);

    // The stranger signs, but points at the owner's vault address.
    let mut ix = create_vault_ix(&stranger.pubkey(), Pubkey::new_unique(), DAY, 3 * DAY);
    ix.accounts[1].pubkey = vault_address(&owner.pubkey());
    assert!(send(&mut svm, ix, &stranger).is_err());
    assert!(svm.get_account(&vault_address(&owner.pubkey())).is_none());
}
