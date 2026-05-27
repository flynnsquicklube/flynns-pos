import type { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3">{children}</div>;
}
