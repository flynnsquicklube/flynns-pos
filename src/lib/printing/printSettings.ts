import { getSetting, setSetting } from "../db/repositories/settingsRepo";
import type { PrintMode, StickerPrinterLanguage } from "./printTypes";

export interface PrintSettings {
  default_print_mode: PrintMode;
  default_invoice_template: string;
  default_receipt_template: string;
  default_sticker_template: string;
  sticker_printer_model: string;
  sticker_printer_language: StickerPrinterLanguage;
  sticker_width_inches: number;
  sticker_height_inches: number;
  sticker_dpi: number;
  next_service_miles: number;
  next_service_months: number;
  show_vin_last8: boolean;
  show_plate: boolean;
  show_filter: boolean;
  show_quarts: boolean;
  show_shop_phone: boolean;
  invoice_show_logo: boolean;
  invoice_show_rewards: boolean;
  invoice_show_disclaimer: boolean;
  invoice_footer: string;
  receipt_show_vehicle: boolean;
  receipt_show_rewards: boolean;
  receipt_footer: string;
}

export const defaultPrintSettings: PrintSettings = {
  default_print_mode: "preview_only",
  default_invoice_template: "flynns_standard_invoice",
  default_receipt_template: "flynns_compact_receipt",
  default_sticker_template: "flynns_oil_change_sticker",
  sticker_printer_model: "Godex RT200i",
  sticker_printer_language: "EZPL",
  sticker_width_inches: 1.8125,
  sticker_height_inches: 2.5,
  sticker_dpi: 203,
  next_service_miles: 3000,
  next_service_months: 3,
  show_vin_last8: true,
  show_plate: true,
  show_filter: true,
  show_quarts: true,
  show_shop_phone: true,
  invoice_show_logo: true,
  invoice_show_rewards: true,
  invoice_show_disclaimer: true,
  invoice_footer: "Thank you for choosing Flynn's Quick Lube.",
  receipt_show_vehicle: true,
  receipt_show_rewards: true,
  receipt_footer: "Thank you for choosing Flynn's Quick Lube."
};

function settingKey(key: keyof PrintSettings) {
  return `printing.${key}`;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getPrintSettings(): Promise<PrintSettings> {
  const entries = await Promise.all(
    Object.keys(defaultPrintSettings).map(async (key) => [key, await getSetting(settingKey(key as keyof PrintSettings))] as const)
  );
  return entries.reduce<PrintSettings>((settings, [key, setting]) => {
    const typedKey = key as keyof PrintSettings;
    const fallback = defaultPrintSettings[typedKey];
    if (typeof fallback === "boolean") return { ...settings, [typedKey]: parseBoolean(setting?.value, fallback) };
    if (typeof fallback === "number") return { ...settings, [typedKey]: parseNumber(setting?.value, fallback) };
    return { ...settings, [typedKey]: setting?.value ?? fallback };
  }, { ...defaultPrintSettings });
}

export async function savePrintSettings(settings: PrintSettings): Promise<void> {
  await Promise.all(Object.entries(settings).map(([key, value]) => setSetting(settingKey(key as keyof PrintSettings), String(value))));
}
