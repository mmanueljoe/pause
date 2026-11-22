import { Fragment } from "react";
import { Check } from "lucide-react";

import { cx } from "./cx";

/**
 * Numbered steps for vault setup. Current: off-white circle. Done: tick.
 * Neutral only. On phone: "Step 1 of 3: Wait time".
 */
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <>
      <p className="text-small text-text-2 md:hidden">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
      <ol
        className="hidden items-center gap-3 md:flex"
        aria-label="Setup steps"
      >
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <Fragment key={label}>
              {i > 0 && <span aria-hidden className="h-px w-8 bg-line" />}
              <li
                className="flex items-center gap-2 text-small"
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={cx(
                    "flex size-7 items-center justify-center rounded-full font-mono text-label font-medium",
                    active && "bg-text text-bg",
                    done && "bg-surface-2 text-text",
                    !active && !done && "border border-line text-text-3"
                  )}
                >
                  {done ? (
                    <Check size={16} strokeWidth={1.5} aria-label="Done" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={
                    active ? "text-text" : done ? "text-text-2" : "text-text-3"
                  }
                >
                  {label}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </>
  );
}
