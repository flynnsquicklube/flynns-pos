import type { ReactNode } from "react";

interface DataTableProps {
  children: ReactNode;
  minWidth?: string;
}

export function DataTable({ children, minWidth = "1080px" }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-card)] shadow-[var(--pos-shadow-card)]">
      <div className="max-w-full overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}
