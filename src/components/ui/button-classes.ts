import { cx } from "./cx";

export type ButtonVariant =
  "primary" | "stop" | "approve" | "secondary" | "link";

export const variantClasses: Record<ButtonVariant, string> = {
  // Off-white pill: one main action per screen.
  primary:
    "bg-text text-bg hover:bg-released active:bg-text-2 disabled:opacity-40 disabled:hover:bg-text",
  // Amber pill: the one action that saves money.
  stop: "bg-waiting text-bg hover:brightness-95 active:brightness-90 disabled:bg-waiting-soft disabled:text-text-3",
  // Outline pill: guardian's Approve now.
  approve:
    "border-[1.5px] border-text text-text hover:bg-surface-2 active:bg-line disabled:border-line disabled:text-text-3",
  secondary:
    "border border-line text-text hover:bg-surface-2 active:bg-line disabled:text-text-3",
  link: "text-text hover:text-text-2 disabled:text-text-3",
};

/** Classes for a button look, for non-interactive previews (e.g. the landing card). */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: "default" | "large" = "default"
) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full text-body whitespace-nowrap",
    variant === "link"
      ? "h-11 px-1"
      : size === "large"
        ? "h-14 px-8"
        : "h-12 px-6",
    variantClasses[variant].replace(/(hover|active|disabled):\S+/g, "")
  );
}
