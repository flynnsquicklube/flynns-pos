import { Input } from "../ui/Input";

interface ThemeColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ThemeColorPicker({ label, value, onChange }: ThemeColorPickerProps) {
  return (
    <label className="text-sm font-semibold text-[var(--pos-muted)]">
      {label}
      <div className="mt-2 grid grid-cols-[52px_1fr] gap-2">
        <input className="h-12 w-12 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-transparent p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}
