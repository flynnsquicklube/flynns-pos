import type { HTMLAttributes } from "react";

type BadgeTone = "blue" | "green" | "yellow" | "red" | "slate" | "purple";

const tones: Record<BadgeTone, string> = {
  blue: "border-blue-200 bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-[var(--pos-border)] bg-[var(--pos-panel-2)] text-[var(--pos-muted)]",
  purple: "border-purple-200 bg-purple-50 text-purple-700"
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className = "", tone = "slate", ...props }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`} {...props} />;
}
