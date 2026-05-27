import type { ManualSearchLink, VehicleInfoLookupContext } from "./vehicleInfo.types";

function vehicleText(context: VehicleInfoLookupContext): string {
  return [context.year, context.make, context.model, context.engine].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function searchUrl(engine: "google" | "bing" | "duckduckgo", query: string): string {
  const encoded = encodeURIComponent(query);
  if (engine === "bing") return `https://www.bing.com/search?q=${encoded}`;
  if (engine === "duckduckgo") return `https://duckduckgo.com/?q=${encoded}`;
  return `https://www.google.com/search?q=${encoded}`;
}

export function buildManualVehicleInfoSearchLinks(context: VehicleInfoLookupContext): ManualSearchLink[] {
  const vehicle = vehicleText(context);
  const vin = context.vin?.trim();
  const baseQueries = [
    vehicle ? `${vehicle} oil capacity` : null,
    vehicle ? `${vehicle} oil filter` : null,
    vehicle ? `${vehicle} 0w20 oil capacity` : null,
    vin ? `${vin} oil capacity` : null,
    vehicle ? `${vehicle} Service Champ oil filter` : null,
    vehicle ? `${vehicle} owner's manual oil capacity` : null
  ].filter((query): query is string => Boolean(query));

  return baseQueries.flatMap((query, index) => [
    { id: `google-${index}`, label: "Open Google Search", query, url: searchUrl("google", query) },
    { id: `bing-${index}`, label: "Open Bing Search", query, url: searchUrl("bing", query) },
    { id: `duck-${index}`, label: "Open DuckDuckGo", query, url: searchUrl("duckduckgo", query) }
  ]);
}
