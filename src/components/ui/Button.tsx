import { type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

import {
  type ButtonVariant as Variant,
  variantClasses as variants,
} from "./button-classes";
import { cx } from "./cx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** "large" (56px) is for the main action on phone. */
  size?: "default" | "large";
  /** Shows "Confirming on Solana…" and blocks clicks. */
  loading?: boolean;
  fullWidth?: boolean;
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
        "focus-ring inline-flex items-center justify-center gap-2 rounded-full text-body whitespace-nowrap transition-colors disabled:cursor-not-allowed",
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
