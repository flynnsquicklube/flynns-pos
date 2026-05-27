import type { VehicleInfoSuggestion } from "./vehicleInfo.types";

const oilTypePattern = /\b(?:0W|5W|10W|15W|20W)[-\s]?\d{2}\b/i;
const quartPattern = /\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:qt|qts|quart|quarts)\b/i;
const filterPattern = /\b(?:OF|PH|WL|CH|PF|LF|FL|M1|XG|TG)[-\s]?[A-Z0-9]{2,12}\b/i;
const airFilterPattern = /\b(?:AF|A)[-\s]?[A-Z0-9]{3,12}\b/i;
const cabinFilterPattern = /\b(?:CAF|CF|C)[-\s]?[A-Z0-9]{3,12}\b/i;

function cleanSku(value: string | undefined): string | null {
  return value ? value.replace(/\s+/g, "").toUpperCase() : null;
}

export function extractVehicleInfoSuggestion(text: string, source?: { title?: string | null; url?: string | null }): VehicleInfoSuggestion {
  const oilType = text.match(oilTypePattern)?.[0]?.toUpperCase().replace(/\s+/, "-") ?? null;
  const quarts = Number(text.match(quartPattern)?.[1] ?? NaN);
  const oilFilterSku = cleanSku(text.match(filterPattern)?.[0]);
  const airFilterSku = cleanSku(text.match(airFilterPattern)?.[0]);
  const cabinFilterSku = cleanSku(text.match(cabinFilterPattern)?.[0]);
  const found = [oilType, Number.isFinite(quarts) ? quarts : null, oilFilterSku, airFilterSku, cabinFilterSku].filter(Boolean).length;

  return {
    oilCapacityQuarts: Number.isFinite(quarts) ? quarts : null,
    oilType,
    oilFilterSku,
    airFilterSku,
    cabinFilterSku,
    sourceUrl: source?.url ?? null,
    sourceTitle: source?.title ?? null,
    confidence: found >= 2 ? "medium" : found === 1 ? "low" : "verify",
    note: found ? "Suggested from a search snippet. Verify before saving." : "No reliable spec pattern found in the snippet."
  };
}
