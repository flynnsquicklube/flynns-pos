import type { ReactNode } from "react";
import { useEffect } from "react";
import { WorkflowStepHeader } from "./WorkflowStepHeader";

interface StartTicketPopoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  onClose: () => void;
  showClose?: boolean;
  closeOnBackdrop?: boolean;
}

export function StartTicketPopout({ title, subtitle, children, footer, onBack, backLabel, onClose, showClose = true, closeOnBackdrop = true }: StartTicketPopoutProps) {
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
        <WorkflowStepHeader title={title} subtitle={subtitle} onBack={onBack} backLabel={backLabel} onClose={onClose} showClose={showClose} />
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--pos-bg)] p-5">
          {children}
        </div>
        {footer ? <footer className="border-t border-[var(--pos-border)] bg-white px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
