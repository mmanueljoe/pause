import {
  MAX_WITHDRAWAL_WAIT_SECS,
  WAIT_UNIT_NAME,
  WAIT_UNIT_SECS,
} from "./constants";

/** Shared by Create vault and Settings so both offer exactly the same waits. */
export const MAX_UNITS = Math.floor(MAX_WITHDRAWAL_WAIT_SECS / WAIT_UNIT_SECS);
export const plural = (n: number) =>
  `${n} ${WAIT_UNIT_NAME}${n === 1 ? "" : "s"}`;

/** Wait choices (docs/requirements.md, Values). Hours become minutes in the demo. */
export const WAIT_CHOICES = [
  {
    units: 1,
    description:
      WAIT_UNIT_NAME === "hour"
        ? "Fastest. Your guardian has one hour to notice."
        : "Fastest. Your guardian has one minute to notice.",
  },
  {
    units: 6,
    description:
      WAIT_UNIT_NAME === "hour"
        ? "A withdrawal at 11 pm would leave at 5 am, while your guardian sleeps."
        : "Enough time to watch your guardian stop a payment.",
  },
  {
    units: 24,
    tag: "Recommended",
    description:
      WAIT_UNIT_NAME === "hour"
        ? "Your guardian has time to see it, even overnight."
        : "Your guardian has time to see it and decide.",
  },
] as const;

export type WaitChoice =
  { kind: "preset"; units: number } | { kind: "custom"; input: string };

/** Number of wait units chosen, or null if the custom value isn't valid yet. */
export function unitsOf(wait: WaitChoice): number | null {
  if (wait.kind === "preset") return wait.units;
  const n = Number(wait.input);
  return Number.isInteger(n) && n >= 1 && n <= MAX_UNITS ? n : null;
}
