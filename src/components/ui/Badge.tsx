import type { HTMLAttributes } from "react";

type BadgeTone = "blue" | "green" | "yellow" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  blue: "border-[var(--brand-primary)] bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700"
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className = "", tone = "slate", ...props }: BadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`} {...props} />;
}
