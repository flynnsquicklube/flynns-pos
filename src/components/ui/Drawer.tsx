import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

export function Drawer({ title, children, footer, onClose }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" role="dialog" aria-modal="true" aria-label={title}>
      <aside className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--pos-border)] bg-[var(--pos-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-5 py-4">
          <h2 className="text-lg font-black text-[var(--pos-text)]">{title}</h2>
          <Button size="sm" variant="ghost" icon={<X size={18} />} aria-label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
        {footer ? <div className="border-t border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-5 py-4">{footer}</div> : null}
      </aside>
    </div>
  );
}
