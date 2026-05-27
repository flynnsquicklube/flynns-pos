import type { ReactNode } from "react";

interface ServiceOperationPanelProps {
  title: string;
  complete: boolean;
  optional?: boolean;
  children: ReactNode;
}

export function ServiceOperationPanel({ title, complete, optional = false, children }: ServiceOperationPanelProps) {
  const statusLabel = optional ? "Optional" : complete ? "Complete" : "Needs Attention";
  return (
    <section className={`rounded-2xl border p-5 ${complete ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-card)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-[var(--pos-text)]">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${complete ? "bg-[var(--pos-blue)] text-white" : "bg-[var(--pos-panel-2)] text-[var(--pos-muted)]"}`}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
