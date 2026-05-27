export interface TabOption<T extends string> {
  key: T;
  label: string;
  disabled?: boolean;
}

export function Tabs<T extends string>({ options, active, onChange }: { options: TabOption<T>[]; active: T; onChange: (key: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-2">
      {options.map((option) => (
        <button
          key={option.key}
          disabled={option.disabled}
          onClick={() => onChange(option.key)}
          className={`min-h-11 rounded-[var(--pos-radius-md)] px-4 text-sm font-black transition ${
            active === option.key ? "bg-[var(--pos-blue)] text-white shadow-[var(--pos-shadow-glow)]" : "text-[var(--pos-muted)] hover:bg-[var(--pos-blue-soft)] hover:text-[var(--pos-text)]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
