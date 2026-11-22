import { CLUSTER } from "../solana/client";

/**
 * Demo mode: the deployed program is the devnet `demo` build, so waits can be
 * as short as 1 minute. Shown on every screen, and impossible outside devnet.
 */
export const DEMO_MODE = CLUSTER === "devnet";

/** Default waits offered at setup, in seconds (docs/requirements.md, Values). */
export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const DEFAULT_WITHDRAWAL_WAIT = 24 * HOUR;
export const DEFAULT_GUARDIAN_WAIT = 3 * DAY;
