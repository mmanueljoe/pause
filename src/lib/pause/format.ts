import { type Address, type Lamports, lamports } from "@solana/kit";

const LAMPORTS_PER_SOL = 1_000_000_000n;

/** "2 SOL", "0.25 SOL", "1,234.5 SOL" (up to 4 decimals, trailing zeros dropped). */
export function formatSol(amount: bigint): string {
  const whole = amount / LAMPORTS_PER_SOL;
  const fraction = amount % LAMPORTS_PER_SOL;
  const decimals = (Number(fraction) / Number(LAMPORTS_PER_SOL))
    .toFixed(4)
    .slice(1)
    .replace(/\.?0+$/, "");
  return `${whole.toLocaleString("en-US")}${decimals} SOL`;
}

/** Parses "2.5" into lamports. Returns null for anything that isn't a positive amount. */
export function parseSol(input: string): Lamports | null {
  const match = input.trim().match(/^(\d+)(?:\.(\d{0,9}))?$/);
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(9, "0"));
  const value = whole * LAMPORTS_PER_SOL + fraction;
  return value > 0n ? lamports(value) : null;
}

/** "2r1M…yNVy": first 4 and last 4 characters. */
export function shortAddress(address: Address | string): string {
  // Word joiners keep "2r1M…yNVy" on one line.
  return `${address.slice(0, 4)}\u2060…\u2060${address.slice(-4)}`;
}

/** "5:42:10" (hours:minutes:seconds) or "42:10" under an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** "5 hours 42 minutes", "3 days", "1 minute". For waits and screen readers. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (days) parts.push(unit(days, "day"));
  if (hours) parts.push(unit(hours, "hour"));
  if (minutes && !days) parts.push(unit(minutes, "minute"));
  if (parts.length === 0) return s > 0 ? "less than a minute" : "0 minutes";
  return parts.slice(0, 2).join(" ");
}

/** "6:42 pm" */
export function formatTime(date: Date): string {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

/** "today at 6:42 pm", "tomorrow at 9:00 am", "Sun at 9:14 pm". Fixed times, never a countdown. */
export function formatArrival(date: Date, now = new Date()): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  const time = formatTime(date);
  if (dayDiff === 0) return `today at ${time}`;
  if (dayDiff === 1) return `tomorrow at ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${date.toLocaleDateString("en-US", { weekday: "short" })} at ${time}`;
  }
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`;
}

/** Unix seconds (as stored on Solana) to a Date. */
export function fromUnix(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}

/** A wait length the way setup shows it: "1 minute", "24 hours", "3 days". */
export function formatWait(seconds: bigint | number): string {
  const s = Number(seconds);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (s % 86_400 === 0 && s >= 2 * 86_400) return unit(s / 86_400, "day");
  if (s % 3600 === 0) return unit(s / 3600, "hour");
  if (s % 60 === 0) return unit(s / 60, "minute");
  return formatDuration(s);
}

/** Short time left for lists: "5h 42m left", "42m left", "38s left". */
export function formatTimeLeft(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return `${s}s left`;
}

/** "≈ $5,950" (whole dollars), or null when there's no price. */
export function formatUsd(
  lamports: bigint,
  solPrice: number | null
): string | null {
  if (solPrice === null) return null;
  const usd = (Number(lamports) / 1_000_000_000) * solPrice;
  return `≈ ${usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

/** "Sat 9:14 pm": fixed day and time, for details and history. */
export function formatDayTime(date: Date): string {
  return `${date.toLocaleDateString("en-US", { weekday: "short" })} ${formatTime(date)}`;
}

/** Exact lamports as an amount-field string ("40.499999999"), never rounded up. */
export function lamportsToInput(amount: bigint): string {
  const whole = amount / LAMPORTS_PER_SOL;
  const fraction = (amount % LAMPORTS_PER_SOL)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

/** What a waiting less-safe change does, in words. */
export function describeChange(
  kind:
    | {
        __kind: "Guardian";
        newGuardian: { __option: "Some"; value: string } | { __option: "None" };
      }
    | { __kind: "WithdrawalWait"; newWaitSecs: bigint },
  hasGuardianNow: boolean
): string {
  if (kind.__kind === "WithdrawalWait") {
    return `shorten the withdrawal wait to ${formatWait(kind.newWaitSecs)}`;
  }
  if (kind.newGuardian.__option === "None") return "remove the guardian";
  const who = shortAddress(kind.newGuardian.value);
  return hasGuardianNow
    ? `change the guardian to ${who}`
    : `add ${who} as guardian`;
}
