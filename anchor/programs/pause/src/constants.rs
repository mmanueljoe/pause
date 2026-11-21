//! Fixed values the program enforces. Wait times are in seconds.

/// Seed for the vault's address: `["vault", owner]`, so each owner has one vault.
pub const VAULT_SEED: &[u8] = b"vault";

pub const MINUTE_SECS: i64 = 60;
pub const HOUR_SECS: i64 = 60 * MINUTE_SECS;
pub const DAY_SECS: i64 = 24 * HOUR_SECS;

/// Shortest withdrawal wait: 1 hour, or 1 minute in the devnet demo build.
#[cfg(not(feature = "demo"))]
pub const MIN_WITHDRAWAL_WAIT_SECS: i64 = HOUR_SECS;
#[cfg(feature = "demo")]
pub const MIN_WITHDRAWAL_WAIT_SECS: i64 = MINUTE_SECS;

/// Longest withdrawal wait: 7 days.
pub const MAX_WITHDRAWAL_WAIT_SECS: i64 = 7 * DAY_SECS;

/// Shortest wait for less-safe changes: 1 day, or 1 minute in the devnet demo build.
#[cfg(not(feature = "demo"))]
pub const MIN_GUARDIAN_WAIT_SECS: i64 = DAY_SECS;
#[cfg(feature = "demo")]
pub const MIN_GUARDIAN_WAIT_SECS: i64 = MINUTE_SECS;

/// Longest wait for less-safe changes: 14 days.
pub const MAX_GUARDIAN_WAIT_SECS: i64 = 14 * DAY_SECS;

// Compile-time guard: a build without the demo feature can never accept
// waits shorter than the real minimums.
#[cfg(not(feature = "demo"))]
const _: () = assert!(MIN_WITHDRAWAL_WAIT_SECS >= HOUR_SECS && MIN_GUARDIAN_WAIT_SECS >= DAY_SECS);
