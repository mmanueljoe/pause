import { formatClock, formatDuration } from "../../lib/pause/format";
import { useNow } from "../../lib/useNow";
import { cx } from "./cx";

type CountdownProps = {
  /** When the wait started (request time). */
  startedAt: Date;
  /** When the wait ends. */
  endsAt: Date;
  /** Turns the bar green with "Stopped". */
  stopped?: boolean;
};

/**
 * The signature element: mono digits over an amber bar that drains left to
 * right, plus the same time in words (live for screen readers, once a minute).
 */
export function Countdown({
  startedAt,
  endsAt,
  stopped = false,
}: CountdownProps) {
  const now = useNow();
  const total = Math.max(1, endsAt.getTime() - startedAt.getTime());
  const leftMs = Math.max(0, endsAt.getTime() - now.getTime());
  const leftSecs = leftMs / 1000;
  const remaining = stopped ? 1 : leftMs / total;
  // Words change at most once a minute, so screen readers aren't flooded.
  const words = stopped
    ? "Stopped. Still in your vault."
    : leftMs <= 0
      ? "The wait is over. Sending now."
      : `${formatDuration(Math.ceil(leftSecs / 60) * 60)} left`;

  return (
    <div className="flex flex-col gap-3">
      <span
        aria-hidden
        className={cx(
          "font-mono text-countdown font-medium md:text-countdown-lg",
          stopped && "text-stopped"
        )}
      >
        {stopped ? "Stopped" : formatClock(leftSecs)}
      </span>
      <div
        aria-hidden
        className="h-1 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cx(
            "ml-auto h-full rounded-full transition-[width,background-color] duration-500",
            stopped ? "bg-stopped" : "bg-waiting"
          )}
          style={{ width: `${Math.max(0, Math.min(1, remaining)) * 100}%` }}
        />
      </div>
      <p className="text-small text-text-2" aria-live="polite">
        {words}
      </p>
    </div>
  );
}
