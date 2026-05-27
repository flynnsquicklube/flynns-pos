import type { ReactNode } from "react";

export function FormField({ label, helperText, errorText, children }: { label: string; helperText?: string; errorText?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[var(--pos-text)]">
      <span>{label}</span>
      <div className="mt-2">{children}</div>
      {helperText ? <p className="mt-1 text-xs font-normal text-[var(--pos-muted)]">{helperText}</p> : null}
      {errorText ? <p className="mt-1 text-xs font-bold text-[var(--pos-danger)]">{errorText}</p> : null}
    </label>
  );
}
