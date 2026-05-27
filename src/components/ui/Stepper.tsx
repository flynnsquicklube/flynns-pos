import { Minus, Plus } from "lucide-react";
import { Button } from "./Button";

export function Stepper({ value, min = 0, step = 1, onChange }: { value: number; min?: number; step?: number; onChange: (value: number) => void }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)]">
      <Button size="sm" variant="ghost" icon={<Minus size={16} />} aria-label="Decrease" onClick={() => onChange(Math.max(min, value - step))} />
      <div className="min-w-12 px-3 text-center text-sm font-black text-[var(--pos-text)]">{value}</div>
      <Button size="sm" variant="ghost" icon={<Plus size={16} />} aria-label="Increase" onClick={() => onChange(value + step)} />
    </div>
  );
}
