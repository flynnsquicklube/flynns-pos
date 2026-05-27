import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  inputSize?: "md" | "touch";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = "", label, helperText, errorText, inputSize = "md", id, leftIcon, rightIcon, ...props }, ref) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);
  const control = (
    <div className="relative">
      {leftIcon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pos-muted)]">{leftIcon}</span> : null}
      <input
        id={inputId}
        ref={ref}
        className={`${inputSize === "touch" ? "min-h-[52px] text-base" : "min-h-12 text-sm"} w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-[var(--pos-text)] outline-none transition placeholder:text-[var(--pos-muted-2)] focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)] ${leftIcon ? "pl-10" : ""} ${rightIcon ? "pr-10" : ""} ${errorText ? "border-red-400" : ""} ${className}`}
        {...props}
      />
      {rightIcon ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--pos-muted)]">{rightIcon}</span> : null}
    </div>
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
});
