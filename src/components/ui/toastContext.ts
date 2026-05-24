import { createContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  notify: (toast: Omit<ToastItem, "id">) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
