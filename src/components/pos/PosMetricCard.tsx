import type { LucideIcon } from "lucide-react";
import { PosCard } from "./PosCard";

export function PosMetricCard({ label, value, icon: Icon, detail }: { label: string; value: string; icon?: LucideIcon; detail?: string }) {
  return (
    <PosCard className="min-h-[132px]">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-bold text-[var(--pos-muted)]">{label}</div>
        {Icon ? <Icon size={21} className="text-[var(--pos-blue-2)]" /> : null}
      </div>
      <div className="mt-4 text-3xl font-black tracking-tight text-[var(--pos-text)]">{value}</div>
      {detail ? <div className="mt-2 text-xs font-semibold text-[var(--pos-muted-2)]">{detail}</div> : null}
    </PosCard>
  );
}
