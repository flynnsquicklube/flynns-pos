import type { ReactNode } from "react";

export function ActionTile({ title, description, icon, selected = false, disabled = false, onClick }: { title: string; description?: string; icon?: ReactNode; selected?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[96px] w-full items-center gap-4 rounded-[var(--pos-radius-lg)] border p-4 text-left transition ${
        selected ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] pos-glow" : "border-[var(--pos-border)] bg-[var(--pos-card)] hover:border-[var(--pos-border-strong)] hover:bg-[var(--pos-card-hover)]"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {icon ? <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--pos-radius-md)] bg-[var(--pos-blue-soft)] text-[var(--pos-blue-2)]">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block font-black text-[var(--pos-text)]">{title}</span>
        {description ? <span className="mt-1 block text-sm text-[var(--pos-muted)]">{description}</span> : null}
      </span>
    </button>
  );
}
