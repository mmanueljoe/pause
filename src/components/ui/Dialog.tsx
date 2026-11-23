import { type ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { cx } from "./cx";

/**
 * Modal on laptop, bottom sheet on phone. Uses the native <dialog> for focus
 * trapping, Esc to close and returning focus to the button that opened it.
 */
export function Dialog({
  title,
  onClose,
  children,
  closable = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** False while a transaction is confirming, so it can't be dismissed mid-send. */
  closable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Open on mount. No close() in cleanup: closing fires the "close" event,
  // which would unmount the dialog straight away (React runs effects twice in
  // development). Unmounting removes the dialog anyway.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (closable) onClose();
      }}
      onClick={(e) => e.target === ref.current && closable && onClose()}
      aria-labelledby={titleId}
      className={cx(
        "m-0 w-full max-w-none bg-transparent p-0 text-text backdrop:bg-bg/80",
        "fixed inset-x-0 top-auto bottom-0",
        "md:inset-0 md:m-auto md:h-fit md:max-w-[440px]"
      )}
    >
      <div className="flex flex-col gap-6 rounded-t-card border border-line bg-surface-1 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-card md:pb-6">
        <div className="flex items-start gap-4">
          <h2
            id={titleId}
            className="flex-1 text-h3 font-semibold md:text-h3-lg"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!closable}
            className="focus-ring -m-3 inline-flex size-11 items-center justify-center rounded-full text-text-2 hover:text-text disabled:opacity-40"
            aria-label="Close"
          >
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
