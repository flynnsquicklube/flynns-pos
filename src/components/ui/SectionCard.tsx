import type { HTMLAttributes, ReactNode } from "react";

interface SectionCardProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  accent?: boolean;
}

export function SectionCard({ title, subtitle, action, accent = false, className = "", children, ...props }: SectionCardProps) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-[var(--pos-card)] shadow-[var(--pos-shadow-card)] ${className}`}
      {...props}
    >
      {accent ? <div className="h-1 bg-gradient-to-r from-[var(--pos-blue)] to-[var(--pos-blue-2)]" /> : null}
      {(title || subtitle || action) ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--pos-border)] px-5 py-4">
          <div>
            {title ? <h2 className="text-lg font-black tracking-tight text-[var(--pos-text)]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm leading-5 text-[var(--pos-muted)]">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
