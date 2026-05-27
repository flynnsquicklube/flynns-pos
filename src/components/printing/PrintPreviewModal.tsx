import { Button } from "../ui/Button";
import type { PrintJob } from "../../lib/printing/printTypes";

interface PrintPreviewModalProps {
  title: string;
  printJob: PrintJob;
  children: React.ReactNode;
  onPrint: () => void;
  onMarkPrinted: () => void;
  onClose: () => void;
}

export function PrintPreviewModal({ title, printJob, children, onPrint, onMarkPrinted, onClose }: PrintPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 print:static print:block print:bg-white print:p-0">
      <div className="flex max-h-[94vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-[var(--pos-panel)] shadow-2xl print:max-h-none print:max-w-none print:border-0 print:bg-white print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pos-border)] px-5 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-black text-[var(--pos-text)]">{title}</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--pos-muted)]">Job {printJob.id} · {printJob.document_type.replace("_", " ")} · {printJob.status}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#EEF2F7] px-3 py-5 sm:px-6 sm:py-7 print:overflow-visible print:bg-white print:p-0">
          {children}
        </div>
        <div className="sticky bottom-0 grid gap-3 border-t border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 shadow-[0_-12px_30px_rgba(14,27,51,0.08)] sm:grid-cols-3 print:hidden">
          <Button variant="secondary" onClick={onClose}>Skip / Print Later</Button>
          <Button variant="secondary" onClick={onPrint}>Print Preview / System Print</Button>
          <Button onClick={onMarkPrinted}>Mark Printed</Button>
        </div>
      </div>
    </div>
  );
}
