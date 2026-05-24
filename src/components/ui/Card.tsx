import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
}

export function Card({ className = "", interactive = false, selected = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-[var(--brand-surface)] shadow-sm ${
        selected ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] ring-2 ring-[rgba(11,124,255,0.26)] pos-glow" : "border-[var(--pos-border)] bg-[var(--pos-card)]"
      } ${interactive ? "transition hover:-translate-y-0.5 hover:border-[var(--pos-border-strong)] hover:bg-[var(--pos-card-hover)] hover:shadow-md" : ""} ${className}`}
      {...props}
    />
  );
}
