import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, message, action, icon }: EmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-[var(--pos-radius-lg)] border border-dashed border-[var(--pos-border)] bg-[var(--pos-panel)]/70 p-8 text-center">
      {icon ? <div className="mb-4 opacity-70">{icon}</div> : null}
      <h3 className="text-base font-black text-[var(--pos-text)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--pos-muted)]">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
