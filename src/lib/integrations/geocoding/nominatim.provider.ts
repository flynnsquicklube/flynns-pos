import type { GeocodeResult } from "./geocoding.types";

let lastCallAt = 0;

async function waitForRateLimit(): Promise<boolean> {
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < 1100) return false;
  lastCallAt = Date.now();
  return true;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult[]> {
  if (!(await waitForRateLimit())) throw new Error("Nominatim is rate limited. Try again in a moment.");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FlynnsQuickLubePOS/0.1 local-first desktop POS"
    }
  });
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}.`);
  const rows = await response.json() as Array<{ display_name?: string; lat?: string; lon?: string }>;
  return rows.map((row) => ({
    label: row.display_name ?? "Address match",
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    raw: row
  })).filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}
