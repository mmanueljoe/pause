import { type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

import { cx } from "./cx";

type Variant = "primary" | "stop" | "approve" | "secondary" | "link";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** "large" (56px) is for the main action on phone. */
  size?: "default" | "large";
  /** Shows "Confirming on Solana…" and blocks clicks. */
  loading?: boolean;
  fullWidth?: boolean;
};

const variants: Record<Variant, string> = {
  // Off-white pill: one main action per screen.
  primary:
    "bg-text text-bg hover:bg-released active:bg-text-2 disabled:bg-text-3 disabled:text-surface-2",
  // Amber pill: the one action that saves money.
  stop: "bg-waiting text-bg hover:brightness-95 active:brightness-90 disabled:bg-waiting-soft disabled:text-text-3",
  // Outline pill: guardian's Approve now.
  approve:
    "border border-text text-text hover:bg-surface-2 active:bg-line disabled:border-line disabled:text-text-3",
  secondary:
    "border border-line text-text hover:bg-surface-2 active:bg-line disabled:text-text-3",
  link: "text-text hover:text-text-2 disabled:text-text-3",
};

export function Button({
  variant = "primary",
  size = "default",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isLink = variant === "link";
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-full text-body font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        !isLink && (size === "large" ? "h-14 px-8" : "h-12 px-6"),
        isLink && "h-11 px-1",
        fullWidth && "w-full",
        variants[variant],
        className
      )}
      {...rest}
    >
      {loading ? (
        <>
          <LoaderCircle
            size={20}
            strokeWidth={1.5}
            className="animate-spin"
            aria-hidden
          />
          Confirming on Solana…
        </>
      ) : (
        children
      )}
    </button>
  );
}
