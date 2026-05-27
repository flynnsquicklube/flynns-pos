import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-[var(--pos-radius-lg)] border border-dashed border-[var(--pos-border)] bg-[var(--pos-panel)]/70 p-6 text-center">
      <h3 className="text-base font-black text-[var(--pos-text)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--pos-muted)]">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
