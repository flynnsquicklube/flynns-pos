import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  variant?: "default" | "elevated" | "interactive" | "selected" | "warning" | "danger" | "success";
}

const variants = {
  default: "border-[var(--pos-border)] bg-[var(--pos-card)] shadow-[var(--pos-shadow-card)]",
  elevated: "border-[var(--pos-border-strong)] bg-[var(--pos-card)] shadow-[0_18px_48px_rgba(14,27,51,0.11)]",
  interactive: "border-[var(--pos-border)] bg-[var(--pos-card)] shadow-[var(--pos-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--pos-border-strong)] hover:bg-[var(--pos-card-hover)] hover:shadow-[0_18px_48px_rgba(14,27,51,0.12)]",
  selected: "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] ring-2 ring-[rgba(11,124,255,0.26)] pos-glow",
  warning: "border-amber-500/40 bg-amber-500/10 shadow-[var(--pos-shadow-card)]",
  danger: "border-red-500/40 bg-red-500/10 shadow-[var(--pos-shadow-card)]",
  success: "border-emerald-500/40 bg-emerald-500/10 shadow-[var(--pos-shadow-card)]"
};

export function Card({ className = "", interactive = false, selected = false, variant = "default", ...props }: CardProps) {
  const resolvedVariant = selected ? "selected" : interactive ? "interactive" : variant;
  return (
    <div
      className={`rounded-[var(--pos-radius-lg)] border ${variants[resolvedVariant]} ${className}`}
      {...props}
    />
  );
}
