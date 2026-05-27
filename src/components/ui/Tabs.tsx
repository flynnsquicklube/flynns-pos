export interface TabOption<T extends string> {
  key: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

export function Tabs<T extends string>({ options, active, onChange }: { options: TabOption<T>[]; active: T; onChange: (key: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-1.5">
      {options.map((option) => (
        <button
          key={option.key}
          disabled={option.disabled}
          onClick={() => onChange(option.key)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-[var(--pos-radius-md)] px-4 text-sm font-black transition ${
            active === option.key
              ? "bg-[var(--pos-blue)] text-white shadow-sm"
              : "text-[var(--pos-muted)] hover:bg-[var(--pos-card)] hover:text-[var(--pos-text)]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${active === option.key ? "bg-white/25 text-white" : "bg-[var(--pos-border)] text-[var(--pos-muted)]"}`}>
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
