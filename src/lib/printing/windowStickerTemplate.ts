import type { WindowStickerPayload } from "./printTypes";

export function renderWindowStickerHtml(payload: WindowStickerPayload): string {
  const sticker = payload.sticker;
  return `
    <section class="window-sticker-print">
      <header>
        <strong>${sticker.businessName}</strong>
        ${sticker.shopPhone ? `<span>${sticker.shopPhone}</span>` : ""}
      </header>
      <main>
        <div class="label">Next Service</div>
        <div class="miles">${sticker.nextServiceMileage ? sticker.nextServiceMileage.toLocaleString() : "Mileage Due"} mi</div>
        <div class="date">${new Date(sticker.nextServiceDate).toLocaleDateString()}</div>
        <dl>
          <dt>Vehicle</dt><dd>${sticker.vehicleLabel || "Vehicle"}</dd>
          <dt>Plate</dt><dd>${sticker.plate ?? "-"}</dd>
          <dt>VIN</dt><dd>${sticker.vinLast8 ?? "-"}</dd>
          <dt>Oil</dt><dd>${sticker.oilType ?? "Not recorded"}</dd>
          <dt>Quarts</dt><dd>${sticker.actualQuarts ?? "-"}</dd>
          <dt>Filter</dt><dd>${sticker.oilFilterLabel ?? "Not recorded"}</dd>
        </dl>
      </main>
      <footer>Ticket ${sticker.ticketId}</footer>
    </section>
  `;
}
