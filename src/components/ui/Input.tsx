import { type InputHTMLAttributes, type Ref, useId } from "react";

import { cx } from "./cx";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Help text below the field. Replaced by `error` when there is one. */
  help?: string;
  error?: string;
  /** Mono font, for addresses and amounts. */
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export function Input({
  label,
  help,
  error,
  mono,
  className,
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? help;
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-small text-text-2">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cx(
          "h-12 rounded-input border bg-surface-2 px-4 text-body text-text placeholder:text-text-3",
          "focus:border-text focus:outline-none disabled:cursor-not-allowed disabled:text-text-3",
          error ? "border-error" : "border-line",
          mono && "font-mono text-small"
        )}
        {...rest}
      />
      {note && (
        <p
          id={noteId}
          className={cx("text-small", error ? "text-error" : "text-text-3")}
        >
          {note}
        </p>
      )}
    </div>
  );
}
