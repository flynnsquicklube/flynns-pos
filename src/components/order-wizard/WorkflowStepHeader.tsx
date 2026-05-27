import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "../ui/Button";

interface WorkflowStepHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  onClose?: () => void;
  showClose?: boolean;
  rightAction?: ReactNode;
}

export function WorkflowStepHeader({ title, subtitle, onBack, backLabel = "Back", onClose, showClose = true, rightAction }: WorkflowStepHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--pos-border)] bg-white px-6 py-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {onBack ? <Button variant="secondary" size="sm" icon={<ArrowLeft size={17} />} onClick={onBack}>{backLabel}</Button> : null}
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-[var(--pos-text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--pos-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {rightAction}
        {showClose && onClose ? <Button variant="ghost" size="sm" icon={<X size={18} />} aria-label="Close" onClick={onClose} /> : null}
      </div>
    </header>
  );
}
