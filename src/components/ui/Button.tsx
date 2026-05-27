import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "subtle" | "disabled";
type ButtonSize = "sm" | "md" | "lg" | "touch";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--pos-blue)] text-white shadow-sm hover:bg-[var(--pos-blue-2)] focus-visible:ring-[var(--pos-blue-soft)] disabled:border disabled:border-[var(--pos-border)] disabled:bg-[var(--pos-panel-2)] disabled:text-[var(--pos-muted-2)]",
  secondary: "border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-text)] shadow-sm hover:border-[var(--pos-border-strong)] hover:bg-[var(--pos-card-hover)] focus-visible:ring-[var(--pos-blue-soft)]",
  ghost: "bg-transparent text-[var(--pos-muted)] hover:bg-[var(--pos-blue-soft)] hover:text-[var(--pos-text)] focus-visible:ring-[var(--pos-blue-soft)]",
  subtle: "border border-transparent bg-[var(--pos-blue-soft)] text-[var(--pos-blue)] hover:border-[var(--pos-border-strong)] hover:bg-[#d9ebff] focus-visible:ring-[var(--pos-blue-soft)]",
  danger: "bg-[var(--pos-danger)] text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-950 disabled:border disabled:border-[var(--pos-border)] disabled:bg-[var(--pos-panel-2)] disabled:text-[var(--pos-muted-2)]",
  success: "bg-[var(--pos-success)] text-white shadow-sm hover:bg-emerald-500 focus-visible:ring-emerald-950 disabled:border disabled:border-[var(--pos-border)] disabled:bg-[var(--pos-panel-2)] disabled:text-[var(--pos-muted-2)]",
  warning: "bg-[var(--pos-warning)] text-slate-950 shadow-sm hover:bg-amber-400 focus-visible:ring-amber-950 disabled:border disabled:border-[var(--pos-border)] disabled:bg-[var(--pos-panel-2)] disabled:text-[var(--pos-muted-2)]",
  disabled: "border border-[var(--pos-border)] bg-[var(--pos-panel-2)] text-[var(--pos-muted-2)]"
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-12 px-3 text-sm",
  md: "min-h-12 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
  touch: "min-h-[52px] px-5 text-base"
};

export function Button({ className = "", variant = "primary", size = "md", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--pos-radius-md)] font-bold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
