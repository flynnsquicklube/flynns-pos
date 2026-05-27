import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, children, className = "" }: PageHeaderProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-white px-6 py-5 shadow-[var(--pos-shadow-card)]">
        <div>
          <h1 className="text-2xl font-black leading-tight tracking-tight text-[var(--pos-text)] md:text-[28px]">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--pos-muted)]">{subtitle}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}
