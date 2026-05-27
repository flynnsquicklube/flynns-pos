import type { ReactNode } from "react";

export type PageTheme = "blue" | "cyan" | "indigo" | "amber" | "emerald" | "purple" | "orange" | "slate";

const themeAccent: Record<PageTheme, string> = {
  blue:    "border-t-[var(--pos-blue)]",
  cyan:    "border-t-cyan-400",
  indigo:  "border-t-indigo-500",
  amber:   "border-t-amber-400",
  emerald: "border-t-emerald-500",
  purple:  "border-t-purple-500",
  orange:  "border-t-orange-500",
  slate:   "border-t-[var(--pos-border-strong)]"
};

const themeTitle: Record<PageTheme, string> = {
  blue:    "text-[var(--pos-blue)]",
  cyan:    "text-cyan-600",
  indigo:  "text-indigo-600",
  amber:   "text-amber-600",
  emerald: "text-emerald-600",
  purple:  "text-purple-600",
  orange:  "text-orange-600",
  slate:   "text-[var(--pos-muted)]"
};

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  theme?: PageTheme;
}

export function PageHeader({ title, subtitle, action, children, className = "", theme }: PageHeaderProps) {
  const accentClass = theme ? themeAccent[theme] : "";
  const titleClass = theme ? themeTitle[theme] : "text-[var(--pos-text)]";
  const borderTop = theme ? `border-t-4 ${accentClass}` : "";
  return (
    <div className={`space-y-4 ${className}`}>
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-white px-6 py-5 shadow-[var(--pos-shadow-card)] ${borderTop}`}>
        <div>
          <h1 className={`text-2xl font-black leading-tight tracking-tight md:text-[28px] ${titleClass}`}>{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--pos-muted)]">{subtitle}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}
