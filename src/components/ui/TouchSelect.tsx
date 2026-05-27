import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { Input } from "./Input";

export interface TouchSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface TouchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: TouchSelectOption[];
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  helperText?: string;
  emptyText?: string;
  className?: string;
  size?: "md" | "touch";
  clearable?: boolean;
}

export function TouchSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  label,
  searchable,
  disabled = false,
  loading = false,
  error,
  helperText,
  emptyText = "No options found.",
  className = "",
  size = "touch",
  clearable = false
}: TouchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;
  const shouldSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Enter" && filtered.length === 1 && !filtered[0].disabled) {
        onChange(filtered[0].value);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, onChange, open]);

  const trigger = (
    <button
      type="button"
      disabled={disabled || loading}
      className={`${size === "touch" ? "min-h-[52px] text-base" : "min-h-12 text-sm"} flex w-full items-center justify-between gap-3 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-left font-bold text-[var(--pos-text)] shadow-sm outline-none transition hover:border-[var(--pos-blue)] hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-red-400" : ""} ${className}`}
      onClick={() => {
        setQuery("");
        setOpen(true);
      }}
    >
      <span className={selected ? "" : "text-[var(--pos-muted)]"}>{loading ? "Loading..." : selected?.label ?? placeholder}</span>
      <ChevronDown size={18} className="shrink-0 text-[var(--pos-blue)]" />
    </button>
  );

  const modal = open ? createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label={label ?? placeholder} onMouseDown={() => setOpen(false)}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--pos-border)] p-5">
          <div>
            <h2 className="text-2xl font-black text-[var(--pos-text)]">{label ?? placeholder}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">Tap an option to select it.</p>
          </div>
          <Button variant="ghost" size="sm" icon={<X size={20} />} aria-label="Close selector" onClick={() => setOpen(false)} />
        </div>
        {shouldSearch ? (
          <div className="border-b border-[var(--pos-border)] p-5">
            <Input
              inputSize="touch"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search options"
              autoFocus
              leftIcon={<Search size={18} />}
            />
          </div>
        ) : null}
        <div className="max-h-[58vh] overflow-y-auto p-4">
          {clearable ? (
            <button
              type="button"
              className="mb-2 flex min-h-12 w-full items-center rounded-xl border border-dashed border-[var(--pos-border)] bg-white px-4 text-left text-sm font-black text-[var(--pos-muted)] hover:border-[var(--pos-blue)]"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          ) : null}
          <div className="grid gap-2">
            {filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={`flex min-h-[52px] items-center justify-between gap-3 rounded-xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]"
                      : "border-[var(--pos-border)] bg-white text-[var(--pos-text)] hover:border-[var(--pos-blue)] hover:bg-[var(--pos-panel-2)]"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>
                    <span className="block text-base font-black">{option.label}</span>
                    {option.description ? <span className="mt-1 block text-sm font-semibold text-[var(--pos-muted)]">{option.description}</span> : null}
                  </span>
                  {isSelected ? <Check size={18} /> : null}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--pos-border)] p-6 text-center text-sm font-semibold text-[var(--pos-muted)]">{emptyText}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  if (!label && !helperText && !error) {
    return (
      <>
        {trigger}
        {modal}
      </>
    );
  }

  return (
    <div className="block text-sm font-semibold text-[var(--pos-text)]">
      {label ? <span>{label}</span> : null}
      <div className={label ? "mt-2" : ""}>{trigger}</div>
      {helperText ? <p className="mt-1 text-xs font-normal text-[var(--pos-muted)]">{helperText}</p> : null}
      {error ? <p className="mt-1 text-xs font-semibold text-[var(--pos-danger)]">{error}</p> : null}
      {modal}
    </div>
  );
}
