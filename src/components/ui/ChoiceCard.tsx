import { type ReactNode } from "react";

import { cx } from "./cx";

type ChoiceCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: ReactNode;
  /** Small tag beside the title, e.g. "Recommended". */
  tag?: string;
};

/** A card that behaves like a radio button (wait-time choices). */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  tag,
}: ChoiceCardProps) {
  return (
    <label
      className={cx(
        "flex cursor-pointer flex-col gap-3 rounded-card border bg-surface-1 p-6 transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-text has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg",
        checked ? "border-text" : "border-line hover:border-text-3"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cx(
          "flex size-5 items-center justify-center rounded-full border",
          checked ? "border-text" : "border-text-3"
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-text" />}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-h3 font-semibold md:text-h3-lg">{title}</span>
        {tag && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-small text-text-2">
            {tag}
          </span>
        )}
      </span>
      {description && (
        <span className="text-small text-text-2">{description}</span>
      )}
    </label>
  );
}
