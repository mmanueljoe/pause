/** Shown when a transaction fails (docs/requirements.md, "Error copy"). */
export const TRANSACTION_FAILED =
  "That didn't go through. Nothing was sent. Try again.";

/**
 * Plain-language reasons for Pause's program errors, by error code
 * (anchor/programs/pause/src/errors.rs; codes start at 6000).
 */
const PAUSE_ERROR_REASONS: Record<number, string> = {
  6000: "Your guardian can't be your own wallet.",
  6001: "Enter your guardian's wallet address.",
  6002: "That wait is too short.",
  6003: "The longest wait is 7 days.",
  6004: "That guardian wait is too short.",
  6005: "The longest guardian wait is 14 days.",
  6006: "Enter an amount more than 0.",
  6007: "That amount is too small to send.",
  6008: "Your vault doesn't have that much free. Some may already be waiting to leave.",
  6009: "Enter the address to send to.",
  6010: "That number is too large.",
  6011: "Only the owner or the guardian can do this.",
  6012: "Only the guardian can do this.",
  6013: "This payment isn't waiting any more.",
  6014: "The wait hasn't ended yet.",
  6015: "That isn't the address this payment goes to.",
  6016: "You can't send to the vault itself.",
  6017: "Something went wrong in the vault. Nothing was sent.",
  6018: "Another change is already waiting. Cancel it first.",
  6019: "There's no change waiting.",
  6020: "That's already your setting.",
  6021: "Your vault has no guardian to remove.",
};

export type FriendlyError = {
  /** What to show on screen. */
  message: string;
  /** True when the person closed or rejected the wallet prompt. */
  rejected: boolean;
};

/** Turns any send error into words a person can act on. */
export function toFriendlyError(error: unknown): FriendlyError {
  const text = collectMessages(error).join(" ").toLowerCase();

  if (/reject|denied|declined|cancel/.test(text)) {
    return {
      rejected: true,
      message: "You closed the wallet before approving. Nothing was sent.",
    };
  }
  if (
    /insufficient (funds|lamports)|debit an account but found no record/.test(
      text
    )
  ) {
    return {
      rejected: false,
      message:
        "Your wallet doesn't have enough SOL for this and the network fee.",
    };
  }

  const code = findCustomErrorCode(error);
  if (code !== null && PAUSE_ERROR_REASONS[code]) {
    return {
      rejected: false,
      message: `${PAUSE_ERROR_REASONS[code]} Nothing was sent.`,
    };
  }
  return { rejected: false, message: TRANSACTION_FAILED };
}

function collectMessages(error: unknown, depth = 0): string[] {
  if (!error || depth > 5) return [];
  if (typeof error === "string") return [error];
  if (typeof error !== "object") return [];
  const e = error as { message?: unknown; cause?: unknown; context?: unknown };
  const own = typeof e.message === "string" ? [e.message] : [];
  return [...own, ...collectMessages(e.cause, depth + 1)];
}

/** Finds a program's custom error code (e.g. 6013) anywhere in the error chain. */
function findCustomErrorCode(error: unknown, depth = 0): number | null {
  if (!error || typeof error !== "object" || depth > 5) return null;
  const e = error as { context?: Record<string, unknown>; cause?: unknown };
  const code = e.context?.code;
  if (typeof code === "number" && code >= 6000) return code;
  if (typeof code === "bigint" && code >= 6000n) return Number(code);
  return findCustomErrorCode(e.cause, depth + 1);
}
