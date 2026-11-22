import { type ReactNode, useCallback, useState } from "react";
import { Check, CircleAlert, CircleCheck, X } from "lucide-react";

import { cx } from "./cx";
import { ToastContext, type ToastKind } from "./toast-context";

type ToastItem = { id: number; kind: ToastKind; message: string };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 8000 : 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-5">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-surface-2 py-2 pr-2 pl-4 text-small shadow-lg"
          >
            <ToastIcon kind={t.kind} />
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="focus-ring inline-flex size-8 items-center justify-center rounded-full text-text-2 hover:text-text"
              aria-label="Dismiss"
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  const props = { size: 18, strokeWidth: 1.5, "aria-hidden": true } as const;
  return (
    <span
      className={cx(
        kind === "stopped" && "text-stopped",
        kind === "error" && "text-error"
      )}
    >
      {kind === "success" && <Check {...props} />}
      {kind === "stopped" && <CircleCheck {...props} />}
      {kind === "error" && <CircleAlert {...props} />}
    </span>
  );
}
