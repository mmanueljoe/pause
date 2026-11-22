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
        "inline-flex items-center gap-1 rounded-full py-1 pr-3 pl-2 text-small",
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
        viewBox="0 0 16 16"
        className="size-4"
        fill="currentColor"
        aria-hidden
      >
        <rect x="4" y="3" width="3" height="10" rx="1" />
        <rect x="9" y="3" width="3" height="10" rx="1" />
      </svg>
    );
  }
  if (status === "stopped") {
    return (
      <span aria-hidden className="flex size-4 items-center justify-center">
        <span className="size-2.5 rounded-[2px] bg-current" />
      </span>
    );
  }
  return <Check size={16} strokeWidth={1.5} aria-hidden />;
}

/** Amber outline tag on recipients the vault hasn't paid before (FR-10). */
export function NewAddressTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-waiting px-2 py-0.5 text-small text-waiting">
      New address
    </span>
  );
}
