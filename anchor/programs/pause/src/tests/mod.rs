//! Program tests run in LiteSVM against the built program.
//! Run with `npm run program:test` (builds with the `demo` feature first).

mod create_vault;

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_sdk::{
    instruction::{Instruction, InstructionError},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::{Transaction, TransactionError},
};

use crate::constants::VAULT_SEED;
use crate::state::Vault;
use crate::ID as PROGRAM_ID;

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

/// A fresh test chain with the program loaded.
pub fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let program_bytes = include_bytes!("../../../../target/deploy/pause.so");
    svm.add_program(PROGRAM_ID, program_bytes).unwrap();
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
