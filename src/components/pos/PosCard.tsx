import type { HTMLAttributes, ReactNode } from "react";

interface PosCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  selected?: boolean;
}

export function PosCard({ title, eyebrow, action, selected = false, className = "", children, ...props }: PosCardProps) {
  return (
    <section
      className={`rounded-2xl border ${selected ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] pos-glow" : "border-[var(--pos-border)] bg-[var(--pos-card)]"} p-5 shadow-sm ${className}`}
      {...props}
    >
      {title || eyebrow || action ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {eyebrow ? <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--pos-muted-2)]">{eyebrow}</div> : null}
            {title ? <h2 className="mt-1 text-lg font-black text-[var(--pos-text)]">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
