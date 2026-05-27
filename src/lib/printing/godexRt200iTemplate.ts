import type { PrintSettings } from "./printSettings";
import type { WindowStickerPayload } from "./printTypes";

export function inchesToDots(inches: number, dpi: number): number {
  return Math.round(inches * dpi);
}

export function escapePrinterText(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/["\\]/g, "")
    .trim()
    .slice(0, 64);
}

export function buildGodexEzplWindowStickerCommand(payload: WindowStickerPayload, settings: PrintSettings): string {
  const width = inchesToDots(settings.sticker_width_inches, settings.sticker_dpi);
  const height = inchesToDots(settings.sticker_height_inches, settings.sticker_dpi);
  const sticker = payload.sticker;
  const nextMileage = sticker.nextServiceMileage ? `${sticker.nextServiceMileage.toLocaleString()} MI` : "MILEAGE DUE";
  const nextDate = new Date(sticker.nextServiceDate).toLocaleDateString();

  return [
    "^Q" + height + ",0,0",
    "^W" + width,
    "^H10",
    "^P1",
    "^S4",
    "^AT",
    "^C1",
    "^R0",
    "~Q+0",
    "^O0",
    "^D0",
    "^E12",
    "^L",
    `AT,18,18,28,28,0,0,0,0,${escapePrinterText(sticker.businessName)}`,
    `AT,18,58,22,22,0,0,0,0,NEXT SERVICE`,
    `AT,18,92,34,34,0,0,0,0,${escapePrinterText(nextMileage)}`,
    `AT,18,136,24,24,0,0,0,0,${escapePrinterText(nextDate)}`,
    `AT,18,178,18,18,0,0,0,0,${escapePrinterText(sticker.vehicleLabel)}`,
    `AT,18,206,16,16,0,0,0,0,Oil: ${escapePrinterText(sticker.oilType ?? "Not recorded")}`,
    `AT,18,232,16,16,0,0,0,0,Qt: ${escapePrinterText(sticker.actualQuarts ? String(sticker.actualQuarts) : "-")} Filter: ${escapePrinterText(sticker.oilFilterLabel ?? "Not recorded")}`,
    `AT,18,258,14,14,0,0,0,0,Ticket ${escapePrinterText(sticker.ticketId)}`,
    "E"
  ].join("\n");
}

export function buildGodexGzplWindowStickerCommand(): string {
  return "GZPL window sticker generation is prepared but not implemented. Use EZPL/system print for now.";
}
