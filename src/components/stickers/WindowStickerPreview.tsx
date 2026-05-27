import { Button } from "../ui/Button";
import { formatShopDateTime } from "../../lib/utils/dates";
import type { WindowStickerPrintData } from "../../lib/domain/stickers/windowStickerBuilder";

interface WindowStickerPreviewProps {
  stickerData: WindowStickerPrintData;
  onMarkPrinted: () => void;
  onSkip: () => void;
}

export function WindowStickerPreview({ stickerData, onMarkPrinted, onSkip }: WindowStickerPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--pos-border-strong)] bg-[var(--pos-panel)] shadow-2xl">
        <div className="border-b border-[var(--pos-border)] p-5">
          <h2 className="text-xl font-black text-[var(--pos-text)]">Window Sticker Preview</h2>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Hardware printing is not connected yet. Preview, then mark printed or print later.</p>
        </div>
        <div className="p-5">
          <div className="mx-auto max-w-sm rounded-2xl border-4 border-[var(--pos-blue)] bg-white p-5 text-slate-950 shadow-[0_0_30px_rgba(11,124,255,0.22)]">
            <div className="text-center">
              <div className="text-xl font-black">{stickerData.businessName}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Next Service Reminder</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs font-bold uppercase text-slate-500">Date</div><div className="font-black">{formatShopDateTime(new Date(stickerData.date))}</div></div>
              <div><div className="text-xs font-bold uppercase text-slate-500">Ticket</div><div className="font-black">{stickerData.ticketId}</div></div>
              <div className="col-span-2"><div className="text-xs font-bold uppercase text-slate-500">Vehicle</div><div className="font-black">{stickerData.vehicleLabel || "Vehicle"}</div></div>
              <div><div className="text-xs font-bold uppercase text-slate-500">VIN</div><div className="font-black">{stickerData.vinLast8 ?? "-"}</div></div>
              <div><div className="text-xs font-bold uppercase text-slate-500">Plate</div><div className="font-black">{stickerData.plate ?? "-"}</div></div>
              <div><div className="text-xs font-bold uppercase text-slate-500">Oil</div><div className="font-black">{stickerData.oilType ?? "-"}</div></div>
              <div><div className="text-xs font-bold uppercase text-slate-500">Quarts</div><div className="font-black">{stickerData.actualQuarts}</div></div>
              <div className="col-span-2"><div className="text-xs font-bold uppercase text-slate-500">Filter</div><div className="font-black">{stickerData.oilFilterSku ?? stickerData.oilFilterName ?? "-"}</div></div>
            </div>
            <div className="mt-5 rounded-xl bg-slate-950 p-4 text-center text-white">
              <div className="text-xs font-bold uppercase text-slate-300">Next Service</div>
              <div className="mt-1 text-2xl font-black">{stickerData.nextServiceMileage.toLocaleString()} mi</div>
              <div className="text-sm font-bold">{new Date(stickerData.nextServiceDate).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-[var(--pos-border)] p-5 sm:grid-cols-3">
          <Button variant="secondary" onClick={onSkip}>Skip / Print Later</Button>
          <Button variant="secondary" onClick={() => window.print()}>Print Preview</Button>
          <Button onClick={onMarkPrinted}>Mark Printed</Button>
        </div>
      </div>
    </div>
  );
}
