import { CLUSTER } from "../solana/client";

/**
 * Demo mode: the deployed program is the devnet `demo` build, so waits can be
 * as short as 1 minute. Shown on every screen, and impossible outside devnet.
 */
export const DEMO_MODE = CLUSTER === "devnet";

/** Default waits offered at setup, in seconds (docs/requirements.md, Values). */
export const HOUR = 3600;
export const DAY = 24 * HOUR;

/**
 * One "hour" of wait. In the devnet demo, hours become minutes so the whole
 * demo fits in a 3-minute video (the demo program build allows 1-minute
 * waits). A real launch shows real hours.
 */
export const WAIT_UNIT_SECS = DEMO_MODE ? 60 : HOUR;
export const WAIT_UNIT_NAME = DEMO_MODE ? "minute" : "hour";

/** Guardian change wait: 3 days, or 3 minutes in the demo. */
export const SETUP_GUARDIAN_WAIT_SECS = DEMO_MODE ? 3 * 60 : 3 * DAY;

/** Longest withdrawal wait the program accepts: 7 days. */
export const MAX_WITHDRAWAL_WAIT_SECS = 7 * DAY;
