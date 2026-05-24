import { CheckCircle2 } from "lucide-react";

const steps = [
  { key: "checked_in", label: "Check-In" },
  { key: "in_service", label: "In Bay" },
  { key: "completed", label: "Complete" }
];

export function PosStatusProgress({ status }: { status: string }) {
  const activeIndex = status === "waiting_payment" ? 1 : status === "completed" ? 2 : status === "in_service" ? 1 : 0;
  return (
    <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
      <div className="mb-3 text-sm font-black text-[var(--pos-text)]">Ticket Progress</div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const active = index <= activeIndex;
          return (
            <div key={step.key} className={`rounded-xl border px-3 py-2 text-center text-xs font-black ${active ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-sky-100" : "border-[var(--pos-border)] text-[var(--pos-muted-2)]"}`}>
              {index < activeIndex ? <CheckCircle2 className="mx-auto mb-1" size={16} /> : null}
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
