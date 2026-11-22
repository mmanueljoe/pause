import { Check } from "lucide-react";

import { cx } from "./cx";

type Status = "waiting" | "stopped" | "arrived" | "approved-early";

type StatusLabelProps = {
  status: Status;
  /** The real sentence, e.g. "Paused · arrives 6:42 pm" or "Kofi sent it early". */
  children: string;
};

const styles: Record<Status, string> = {
  waiting: "bg-waiting-soft text-waiting",
  stopped: "bg-stopped-soft text-stopped",
  arrived: "bg-surface-2 text-released",
  "approved-early": "bg-surface-2 text-released",
};

/** Sentence-case status pill with a media-control symbol. No animation. */
export function StatusLabel({ status, children }: StatusLabelProps) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center gap-2 rounded-full px-3 text-small",
        styles[status]
      )}
    >
      <StatusSymbol status={status} />
      {children}
    </span>
  );
}

function StatusSymbol({ status }: { status: Status }) {
  if (status === "waiting") {
    // The logo's two bars: the money is paused, not gone.
    return (
      <svg
        viewBox="0 0 17 24"
        className="h-3 w-2"
        fill="currentColor"
        aria-hidden
      >
        <rect width="6" height="24" rx="2" />
        <rect x="11" width="6" height="24" rx="2" />
      </svg>
    );
  }
  if (status === "stopped") {
    return <span aria-hidden className="size-2.5 rounded-[2px] bg-current" />;
  }
  return <Check size={14} strokeWidth={1.5} aria-hidden />;
}

/** Amber outline tag on recipients the vault hasn't paid before (FR-10). */
export function NewAddressTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-waiting px-2 py-0.5 text-[0.75rem] leading-4 text-waiting">
      New address
    </span>
  );
}
