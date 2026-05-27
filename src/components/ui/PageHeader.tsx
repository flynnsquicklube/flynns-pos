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
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-white p-6 shadow-[var(--pos-shadow-card)]">
        <div>
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-[var(--pos-text)] md:text-[32px]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pos-muted)] md:text-base">{subtitle}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}
