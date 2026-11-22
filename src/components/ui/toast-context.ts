import { createContext, useContext } from "react";

export type ToastKind = "success" | "stopped" | "error";

export const ToastContext = createContext<
  (kind: ToastKind, message: string) => void
>(() => {});

/** `const toast = useToast(); toast("success", "Sent to 7xKp…a91Q")` */
export function useToast() {
  return useContext(ToastContext);
}
