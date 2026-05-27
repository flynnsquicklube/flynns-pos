import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";

interface StartTicketPopoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeOnBackdrop?: boolean;
}

export function StartTicketPopout({ title, subtitle, children, footer, onClose, closeOnBackdrop = true }: StartTicketPopoutProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[var(--pos-border)] bg-[var(--pos-panel)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pos-border)] bg-white px-6 py-5">
          <div>
            <h2 className="text-2xl font-black text-[var(--pos-text)]">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-[var(--pos-muted)]">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="sm" icon={<X size={18} />} aria-label="Close" onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--pos-bg)] p-5">
          {children}
        </div>
        {footer ? <footer className="border-t border-[var(--pos-border)] bg-white px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
