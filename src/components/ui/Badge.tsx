import type { HTMLAttributes } from "react";

type BadgeTone = "blue" | "green" | "yellow" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  blue: "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-sky-100",
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  yellow: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  red: "border-red-500/40 bg-red-500/15 text-red-200",
  slate: "border-[var(--pos-border)] bg-[var(--pos-panel-2)] text-[var(--pos-muted)]"
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className = "", tone = "slate", ...props }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`} {...props} />;
}
