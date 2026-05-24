import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg" | "touch";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--brand-primary)] text-white shadow-sm hover:bg-[var(--brand-primary-dark)] focus-visible:ring-[var(--brand-primary-light)] disabled:bg-slate-200 disabled:text-slate-400",
  secondary: "border border-[var(--brand-border)] bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-[var(--brand-primary-light)]",
  ghost: "bg-transparent text-slate-600 hover:bg-[var(--brand-primary-light)] hover:text-[var(--brand-primary-dark)] focus-visible:ring-[var(--brand-primary-light)]",
  danger: "bg-[var(--brand-danger)] text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-100 disabled:bg-slate-200 disabled:text-slate-400",
  success: "bg-[var(--brand-success)] text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-100 disabled:bg-slate-200 disabled:text-slate-400"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  touch: "min-h-12 px-5 text-base"
};

export function Button({ className = "", variant = "primary", size = "md", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-none focus-visible:ring-4 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
