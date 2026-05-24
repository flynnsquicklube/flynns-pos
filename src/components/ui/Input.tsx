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
      className={`${inputSize === "touch" ? "h-12 text-base" : "h-11 text-sm"} w-full rounded-md border border-[var(--brand-border)] bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-light)] ${errorText ? "border-red-300" : ""} ${className}`}
      {...props}
    />
  );

  if (!label && !helperText && !errorText) return control;

  return (
    <label className="block text-sm font-semibold text-slate-700" htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <div className={label ? "mt-2" : ""}>{control}</div>
      {helperText ? <p className="mt-1 text-xs font-normal text-[var(--brand-muted)]">{helperText}</p> : null}
      {errorText ? <p className="mt-1 text-xs font-semibold text-[var(--brand-danger)]">{errorText}</p> : null}
    </label>
  );
}
