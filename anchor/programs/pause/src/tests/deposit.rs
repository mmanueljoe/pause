//! US-4: depositing into the vault, and who or what is refused.

use anchor_lang::error::ErrorCode as AnchorError;
use solana_sdk::signer::Signer;

use super::*;
use crate::errors::PauseError;

#[test]
fn owner_deposits_and_vault_balance_goes_up() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_vault(&mut svm);
    let before = vault_lamports(&svm, &owner.pubkey());

    let ix = deposit_ix(
        &owner.pubkey(),
        vault_address(&owner.pubkey()),
        2 * LAMPORTS_PER_SOL,
    );
    send(&mut svm, ix, &owner).unwrap();

    assert_eq!(
        vault_lamports(&svm, &owner.pubkey()),
        before + 2 * LAMPORTS_PER_SOL
    );
}

#[test]
fn deposit_of_zero_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_vault(&mut svm);

    let ix = deposit_ix(&owner.pubkey(), vault_address(&owner.pubkey()), 0);
    assert_pause_error(send(&mut svm, ix, &owner), PauseError::AmountIsZero);
}

#[test]
fn guardian_cannot_deposit() {
    let mut svm = setup();
    let (owner, guardian) = owner_with_vault(&mut svm);
    let before = vault_lamports(&svm, &owner.pubkey());

    let ix = deposit_ix(
        &guardian.pubkey(),
        vault_address(&owner.pubkey()),
        LAMPORTS_PER_SOL,
    );
    assert_anchor_error(send(&mut svm, ix, &guardian), AnchorError::ConstraintSeeds);
    assert_eq!(vault_lamports(&svm, &owner.pubkey()), before);
}

#[test]
fn stranger_cannot_deposit() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_vault(&mut svm);
    let stranger = funded_wallet(&mut svm);
    let before = vault_lamports(&svm, &owner.pubkey());

    let ix = deposit_ix(
        &stranger.pubkey(),
        vault_address(&owner.pubkey()),
        LAMPORTS_PER_SOL,
    );
    assert_anchor_error(send(&mut svm, ix, &stranger), AnchorError::ConstraintSeeds);
    assert_eq!(vault_lamports(&svm, &owner.pubkey()), before);
}

#[test]
fn deposit_of_more_than_the_wallet_holds_is_refused() {
    let mut svm = setup();
    let (owner, _guardian) = owner_with_vault(&mut svm);
    let before = vault_lamports(&svm, &owner.pubkey());

    // The owner was funded with 10 SOL.
    let ix = deposit_ix(
        &owner.pubkey(),
        vault_address(&owner.pubkey()),
        20 * LAMPORTS_PER_SOL,
    );
    assert!(send(&mut svm, ix, &owner).is_err());
    assert_eq!(vault_lamports(&svm, &owner.pubkey()), before);
}

#[test]
fn deposit_without_a_vault_is_refused() {
    let mut svm = setup();
    let owner = funded_wallet(&mut svm);

    let ix = deposit_ix(
        &owner.pubkey(),
        vault_address(&owner.pubkey()),
        LAMPORTS_PER_SOL,
    );
    assert_anchor_error(
        send(&mut svm, ix, &owner),
        AnchorError::AccountNotInitialized,
    );
}
