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
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
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
