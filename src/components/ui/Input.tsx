import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  inputSize?: "md" | "touch";
}

export function Input({ className = "", label, helperText, errorText, inputSize = "md", id, ...props }: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);
  const control = (
    <input
      id={inputId}
      className={`${inputSize === "touch" ? "h-12 text-base" : "h-11 text-sm"} w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-[var(--pos-text)] outline-none transition placeholder:text-[var(--pos-muted-2)] focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)] ${errorText ? "border-red-400" : ""} ${className}`}
      {...props}
    />
  );

  if (!label && !helperText && !errorText) return control;

  return (
    <label className="block text-sm font-semibold text-[var(--pos-text)]" htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <div className={label ? "mt-2" : ""}>{control}</div>
      {helperText ? <p className="mt-1 text-xs font-normal text-[var(--pos-muted)]">{helperText}</p> : null}
      {errorText ? <p className="mt-1 text-xs font-semibold text-[var(--pos-danger)]">{errorText}</p> : null}
    </label>
  );
}
