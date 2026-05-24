import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
}

export function Card({ className = "", interactive = false, selected = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-[var(--brand-surface)] shadow-sm ${
        selected ? "border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary-light)]" : "border-[var(--brand-border)]"
      } ${interactive ? "transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-md" : ""} ${className}`}
      {...props}
    />
  );
}
