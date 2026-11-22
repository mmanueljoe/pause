//! Program tests run in LiteSVM against the built program.
//! Run with `npm run program:test` (builds with the `demo` feature first).

mod create_vault;
mod deposit;
mod request_withdrawal;

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_sdk::{
    instruction::{Instruction, InstructionError},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::{Transaction, TransactionError},
};

use crate::constants::{VAULT_SEED, WITHDRAWAL_SEED};
use crate::state::{Vault, Withdrawal};
use crate::ID as PROGRAM_ID;

pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

/// A fresh test chain with the program loaded.
pub fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    // Read at run time (not with include_bytes!) so clippy can compile the
    // tests before the program has been built, e.g. in CI.
    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/pause.so");
    let program_bytes =
        std::fs::read(so_path).expect("pause.so not found: run `npm run program:build` first");
    svm.add_program(PROGRAM_ID, &program_bytes).unwrap();
    svm
}

/// A new wallet with 10 SOL.
pub fn funded_wallet(svm: &mut LiteSVM) -> Keypair {
    let wallet = Keypair::new();
    svm.airdrop(&wallet.pubkey(), 10 * LAMPORTS_PER_SOL)
        .unwrap();
    wallet
}

pub fn vault_address(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[VAULT_SEED, owner.as_ref()], &PROGRAM_ID).0
}

/// Address that signs `emit_cpi!` events.
pub fn event_authority() -> Pubkey {
    Pubkey::find_program_address(&[b"__event_authority"], &PROGRAM_ID).0
}

/// Sends one instruction signed by `signer` (who also pays fees).
pub fn send(svm: &mut LiteSVM, ix: Instruction, signer: &Keypair) -> Result<(), TransactionError> {
    // New blockhash each time so repeated identical transactions aren't deduplicated.
    svm.expire_blockhash();
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&signer.pubkey()),
        &[signer],
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx).map(|_| ()).map_err(|e| e.err)
}

/// Asserts the transaction failed with one of our `PauseError` codes.
pub fn assert_pause_error(
    result: Result<(), TransactionError>,
    expected: crate::errors::PauseError,
) {
    let code = anchor_lang::error::ERROR_CODE_OFFSET + expected as u32;
    assert_eq!(
        result,
        Err(TransactionError::InstructionError(
            0,
            InstructionError::Custom(code)
        )),
    );
}

pub fn read_vault(svm: &LiteSVM, owner: &Pubkey) -> Vault {
    let account = svm
        .get_account(&vault_address(owner))
        .expect("vault exists");
    Vault::try_deserialize(&mut account.data.as_slice()).unwrap()
}

pub fn create_vault_ix(
    owner: &Pubkey,
    guardian: Pubkey,
    withdrawal_wait_secs: i64,
    guardian_wait_secs: i64,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CreateVault {
            owner: *owner,
            vault: vault_address(owner),
            system_program: anchor_lang::system_program::ID,
            event_authority: event_authority(),
            program: PROGRAM_ID,
        }
        .to_account_metas(None),
        data: crate::instruction::CreateVault {
            guardian,
            withdrawal_wait_secs,
            guardian_wait_secs,
        }
        .data(),
    }
}

/// Asserts the transaction failed with one of Anchor's built-in checks
/// (for example a wrong vault address, or a vault that doesn't exist).
pub fn assert_anchor_error(
    result: Result<(), TransactionError>,
    expected: anchor_lang::error::ErrorCode,
) {
    assert_eq!(
        result,
        Err(TransactionError::InstructionError(
            0,
            InstructionError::Custom(expected as u32)
        )),
    );
}

/// All SOL held by the owner's vault account, including its rent minimum.
pub fn vault_lamports(svm: &LiteSVM, owner: &Pubkey) -> u64 {
    svm.get_account(&vault_address(owner))
        .map_or(0, |account| account.lamports)
}

/// A funded owner with a vault (24h withdrawal wait, 3-day guardian wait),
/// and a funded guardian.
pub fn owner_with_vault(svm: &mut LiteSVM) -> (Keypair, Keypair) {
    let owner = funded_wallet(svm);
    let guardian = funded_wallet(svm);
    let day = crate::constants::DAY_SECS;
    let ix = create_vault_ix(&owner.pubkey(), guardian.pubkey(), day, 3 * day);
    send(svm, ix, &owner).unwrap();
    (owner, guardian)
}

/// Deposit signed by `signer` into the vault at `vault`.
pub fn deposit_ix(signer: &Pubkey, vault: Pubkey, amount_lamports: u64) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::Deposit {
            owner: *signer,
            vault,
            system_program: anchor_lang::system_program::ID,
            event_authority: event_authority(),
            program: PROGRAM_ID,
        }
        .to_account_metas(None),
        data: crate::instruction::Deposit { amount_lamports }.data(),
    }
}

pub fn withdrawal_address(vault: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[WITHDRAWAL_SEED, vault.as_ref(), &id.to_le_bytes()],
        &PROGRAM_ID,
    )
    .0
}

pub fn read_withdrawal(svm: &LiteSVM, vault: &Pubkey, id: u64) -> Withdrawal {
    let account = svm
        .get_account(&withdrawal_address(vault, id))
        .expect("withdrawal exists");
    Withdrawal::try_deserialize(&mut account.data.as_slice()).unwrap()
}

/// Sets the chain's clock to `unix_timestamp` (seconds).
pub fn set_time(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock = svm.get_sysvar::<solana_sdk::clock::Clock>();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

/// A withdrawal request signed by `signer`, from the vault at `vault`,
/// creating the record with number `id`.
pub fn request_withdrawal_ix(
    signer: &Pubkey,
    vault: Pubkey,
    id: u64,
    recipient: Pubkey,
    amount_lamports: u64,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::RequestWithdrawal {
            owner: *signer,
            vault,
            withdrawal: withdrawal_address(&vault, id),
            system_program: anchor_lang::system_program::ID,
            event_authority: event_authority(),
            program: PROGRAM_ID,
        }
        .to_account_metas(None),
        data: crate::instruction::RequestWithdrawal {
            recipient,
            amount_lamports,
        }
        .data(),
    }
}

/// An owner with a vault holding `sol` SOL, and their guardian.
pub fn owner_with_funded_vault(svm: &mut LiteSVM, sol: u64) -> (Keypair, Keypair) {
    let (owner, guardian) = owner_with_vault(svm);
    let vault = vault_address(&owner.pubkey());
    send(
        svm,
        deposit_ix(&owner.pubkey(), vault, sol * LAMPORTS_PER_SOL),
        &owner,
    )
    .unwrap();
    (owner, guardian)
}
