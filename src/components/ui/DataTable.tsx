import type { ReactNode } from "react";

interface DataTableProps {
  children: ReactNode;
  minWidth?: string;
}

export function DataTable({ children, minWidth = "1080px" }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white shadow-sm">
      <div className="max-w-full overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}
