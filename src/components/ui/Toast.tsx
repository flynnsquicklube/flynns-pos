import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { ToastContext, type ToastItem } from "./toastContext";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const notify = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { ...toast, id }].slice(-3));
    window.setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? TriangleAlert : Info;
          const toneClass = toast.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : toast.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]";
          return (
            <div key={toast.id} className={`pointer-events-auto flex gap-3 rounded-xl border p-4 shadow-lg ${toneClass}`}>
              <Icon className="mt-0.5 shrink-0" size={20} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{toast.title}</div>
                {toast.message ? <div className="mt-1 text-sm opacity-80">{toast.message}</div> : null}
              </div>
              <button onClick={() => dismiss(toast.id)} className="shrink-0 rounded-md p-1 hover:bg-black/5" aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
