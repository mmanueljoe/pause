//! Program tests run in LiteSVM. Build the program first: `npm run program:build`.

use crate::ID as PROGRAM_ID;
use litesvm::LiteSVM;

fn load_program() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let program_bytes = include_bytes!("../../../target/deploy/pause.so");
    svm.add_program(PROGRAM_ID, program_bytes).unwrap();
    svm
}

#[test]
fn program_loads() {
    let svm = load_program();
    assert!(svm.get_account(&PROGRAM_ID).is_some());
}
