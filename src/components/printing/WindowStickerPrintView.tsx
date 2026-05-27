import type { WindowStickerPayload } from "../../lib/printing/printTypes";

interface WindowStickerPrintViewProps {
  payload: WindowStickerPayload;
  actualSize?: boolean;
}

export function WindowStickerPrintView({ payload, actualSize = false }: WindowStickerPrintViewProps) {
  const sticker = payload.sticker;
  return (
    <div className={actualSize ? "print-sticker-shell actual-size" : "print-sticker-shell"}>
      <section className="print-window-sticker">
        <header>
          <strong>{sticker.businessName}</strong>
          {sticker.shopPhone ? <span>{sticker.shopPhone}</span> : null}
        </header>
        <main>
          <div className="label">Next Service</div>
          <div className="miles">{sticker.nextServiceMileage ? sticker.nextServiceMileage.toLocaleString() : "Mileage Due"} mi</div>
          <div className="date">{new Date(sticker.nextServiceDate).toLocaleDateString()}</div>
          <dl>
            <dt>Vehicle</dt><dd>{sticker.vehicleLabel || "Vehicle"}</dd>
            <dt>Plate</dt><dd>{sticker.plate ?? "-"}</dd>
            <dt>VIN</dt><dd>{sticker.vinLast8 ?? "-"}</dd>
            <dt>Oil</dt><dd>{sticker.oilType ?? "Not recorded"}</dd>
            <dt>Qt</dt><dd>{sticker.actualQuarts ?? "-"}</dd>
            <dt>Filter</dt><dd>{sticker.oilFilterLabel ?? "Not recorded"}</dd>
          </dl>
        </main>
        <footer>Ticket {sticker.ticketId}</footer>
      </section>
    </div>
  );
}
