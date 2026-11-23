import { type ReactNode } from "react";

import { cx } from "./cx";

type ChoiceCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: ReactNode;
  /** Neutral tag at the top right, e.g. "Recommended". Never amber. */
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
        "flex cursor-pointer flex-col gap-3 rounded-card p-6 transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-text has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg",
        checked
          ? "border-[1.5px] border-text bg-surface-2"
          : "border border-line bg-surface-1 hover:border-text-3"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className="flex items-center justify-between">
        <span
          aria-hidden
          className={cx(
            "flex size-5 items-center justify-center rounded-full border-[1.5px]",
            checked ? "border-text" : "border-line"
          )}
        >
          {checked && <span className="size-2.5 rounded-full bg-text" />}
        </span>
        {tag && (
          <span
            className={cx(
              "rounded-full px-2 py-0.5 text-small text-text-2",
              checked ? "bg-surface-1" : "bg-surface-2"
            )}
          >
            {tag}
          </span>
        )}
      </span>
      <span className="text-h3 font-semibold md:text-h3-lg">{title}</span>
      {description && (
        <span className="text-small text-text-2">{description}</span>
      )}
    </label>
  );
}
