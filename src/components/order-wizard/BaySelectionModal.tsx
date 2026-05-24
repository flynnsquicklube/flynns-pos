import { Button } from "../ui/Button";

interface BaySelectionModalProps {
  loading?: boolean;
  bayCounts: { bay1: number; bay2: number };
  onSelect: (bay: "Bay 1" | "Bay 2") => void;
  onCancel: () => void;
}

export function BaySelectionModal({ loading = false, bayCounts, onSelect, onCancel }: BaySelectionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--pos-border-strong)] bg-[var(--pos-panel)] p-6 shadow-2xl">
        <h2 className="text-2xl font-black text-[var(--pos-text)]">Select Service Bay</h2>
        <p className="mt-1 text-sm text-[var(--pos-muted)]">Start this ticket in a bay and queue the oil change sticker.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            disabled={loading}
            onClick={() => onSelect("Bay 1")}
            className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-5 text-left transition hover:border-[var(--pos-blue)] hover:bg-[var(--pos-blue-soft)] disabled:opacity-60"
          >
            <div className="text-xl font-black text-[var(--pos-text)]">Bay 1</div>
            <div className="mt-2 text-sm text-[var(--pos-muted)]">{bayCounts.bay1} active ticket{bayCounts.bay1 === 1 ? "" : "s"}</div>
          </button>
          <button
            disabled={loading}
            onClick={() => onSelect("Bay 2")}
            className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-5 text-left transition hover:border-[var(--pos-blue)] hover:bg-[var(--pos-blue-soft)] disabled:opacity-60"
          >
            <div className="text-xl font-black text-[var(--pos-text)]">Bay 2</div>
            <div className="mt-2 text-sm text-[var(--pos-muted)]">{bayCounts.bay2} active ticket{bayCounts.bay2 === 1 ? "" : "s"}</div>
          </button>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
