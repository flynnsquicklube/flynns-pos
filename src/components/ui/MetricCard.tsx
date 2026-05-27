import type { ReactNode } from "react";
import { Card } from "./Card";

export function MetricCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-bold text-[var(--pos-muted)]">{label}</div>
        {icon ? <div className="text-[var(--pos-blue-2)]">{icon}</div> : null}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-[var(--pos-text)]">{value}</div>
      {detail ? <div className="mt-2 text-xs font-semibold text-[var(--pos-muted-2)]">{detail}</div> : null}
    </Card>
  );
}
