import { type HTMLAttributes } from "react";

import { cx } from "./cx";

/** Surface 1, 1px line, 16 radius, 24 padding. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface-1 p-6",
        className
      )}
      {...rest}
    />
  );
}
