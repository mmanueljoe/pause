//! US-5, US-15: requesting a withdrawal, and who or what is refused.

use anchor_lang::error::ErrorCode as AnchorError;
use solana_sdk::{pubkey::Pubkey, signer::Signer};

use super::*;
use crate::constants::DAY_SECS;
use crate::errors::PauseError;
use crate::state::WithdrawalStatus;

const SOL: u64 = LAMPORTS_PER_SOL;
const NOW: i64 = 1_800_000_000;

#[test]
fn owner_requests_withdrawal_and_nothing_moves_yet() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());
    let recipient = Pubkey::new_unique();
    let vault_before = vault_lamports(&svm, &owner.pubkey());
    set_time(&mut svm, NOW);

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, recipient, 2 * SOL);
    send(&mut svm, ix, &owner).unwrap();

    let withdrawal = read_withdrawal(&svm, &vault, 0);
    assert_eq!(withdrawal.vault, vault);
    assert_eq!(withdrawal.id, 0);
    assert_eq!(withdrawal.recipient, recipient);
    assert_eq!(withdrawal.amount_lamports, 2 * SOL);
    assert_eq!(withdrawal.requested_at, NOW);
    assert_eq!(withdrawal.release_at, NOW + DAY_SECS);
    assert_eq!(withdrawal.status, WithdrawalStatus::Waiting);

    // Every withdrawal waits: the SOL is still in the vault, the recipient has nothing.
    assert_eq!(vault_lamports(&svm, &owner.pubkey()), vault_before);
    assert!(svm.get_account(&recipient).is_none());

    let vault_state = read_vault(&svm, &owner.pubkey());
    assert_eq!(vault_state.reserved_lamports, 2 * SOL);
    assert_eq!(vault_state.next_withdrawal_id, 1);
}

#[test]
fn owner_can_request_the_whole_balance() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    // The rescue case (US-8b): everything to a new wallet. It still waits.
    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), 5 * SOL);
    send(&mut svm, ix, &owner).unwrap();
    assert_eq!(
        read_withdrawal(&svm, &vault, 0).status,
        WithdrawalStatus::Waiting
    );
}

#[test]
fn several_withdrawals_wait_at_once_each_with_its_own_timer() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    set_time(&mut svm, NOW);
    let first = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), SOL);
    send(&mut svm, first, &owner).unwrap();

    set_time(&mut svm, NOW + 600);
    let second = request_withdrawal_ix(&owner.pubkey(), vault, 1, Pubkey::new_unique(), SOL);
    send(&mut svm, second, &owner).unwrap();

    assert_eq!(read_withdrawal(&svm, &vault, 0).release_at, NOW + DAY_SECS);
    assert_eq!(
        read_withdrawal(&svm, &vault, 1).release_at,
        NOW + 600 + DAY_SECS
    );
    assert_eq!(read_vault(&svm, &owner.pubkey()).reserved_lamports, 2 * SOL);
}

#[test]
fn sol_already_waiting_cannot_be_requested_again() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    let first = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), 4 * SOL);
    send(&mut svm, first, &owner).unwrap();

    // Only 1 SOL is still available.
    let too_much = request_withdrawal_ix(&owner.pubkey(), vault, 1, Pubkey::new_unique(), 2 * SOL);
    assert_pause_error(
        send(&mut svm, too_much, &owner),
        PauseError::NotEnoughInVault,
    );

    let rest = request_withdrawal_ix(&owner.pubkey(), vault, 1, Pubkey::new_unique(), SOL);
    send(&mut svm, rest, &owner).unwrap();
}

#[test]
fn more_than_the_vault_holds_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), 5 * SOL + 1);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::NotEnoughInVault);
}

#[test]
fn guardian_cannot_request_a_withdrawal() {
    let mut svm = setup();
    let (owner, guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    let ix = request_withdrawal_ix(&guardian.pubkey(), vault, 0, guardian.pubkey(), SOL);
    assert_anchor_error(send(&mut svm, ix, &guardian), AnchorError::ConstraintSeeds);
    assert_eq!(read_vault(&svm, &owner.pubkey()).reserved_lamports, 0);
}

#[test]
fn stranger_cannot_request_a_withdrawal() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let stranger = funded_wallet(&mut svm);
    let vault = vault_address(&owner.pubkey());

    let ix = request_withdrawal_ix(&stranger.pubkey(), vault, 0, stranger.pubkey(), SOL);
    assert_anchor_error(send(&mut svm, ix, &stranger), AnchorError::ConstraintSeeds);
    assert_eq!(read_vault(&svm, &owner.pubkey()).reserved_lamports, 0);
}

#[test]
fn withdrawal_of_zero_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), 0);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::AmountIsZero);
}

#[test]
fn withdrawal_below_the_minimum_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());
    let minimum = svm.minimum_balance_for_rent_exemption(0);

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), minimum - 1);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::AmountBelowMinimum);

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::new_unique(), minimum);
    send(&mut svm, ix, &owner).unwrap();
}

#[test]
fn withdrawal_to_the_empty_address_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, Pubkey::default(), SOL);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::RecipientIsEmpty);
}

#[test]
fn withdrawal_to_the_vault_itself_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_funded_vault(&mut svm, 5);
    let vault = vault_address(&owner.pubkey());

    let ix = request_withdrawal_ix(&owner.pubkey(), vault, 0, vault, SOL);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::RecipientNotAllowed);
}
