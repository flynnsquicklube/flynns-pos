import { execute, query } from "../../db/sqlite";
import { getSetting, setSetting } from "../../db/repositories/settingsRepo";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { geocodeAddress as geocodeWithNominatim } from "./nominatim.provider";
import type { GeocodingResponse, GeocodeResult } from "./geocoding.types";

export async function isGeocodingEnabled(): Promise<boolean> {
  const setting = await getSetting("feature.enableOpenStreetMapGeocoding");
  return setting?.value === "true" || setting?.value === "1";
}

export async function setGeocodingEnabled(enabled: boolean): Promise<void> {
  await setSetting("feature.enableOpenStreetMapGeocoding", enabled ? "true" : "false");
}

export async function geocodeAddress(address: string): Promise<GeocodingResponse> {
  if (!(await isGeocodingEnabled())) return { ok: false, status: "disabled", message: "OpenStreetMap geocoding is disabled.", results: [] };
  const cacheKey = `nominatim:${address.trim().toLowerCase()}`;
  const cached = await query<{ response_json: string }>("SELECT response_json FROM geocoding_cache WHERE cache_key = ?", [cacheKey]);
  if (cached[0]) {
    return { ok: true, status: "cached", message: "Loaded geocode result from local cache.", results: JSON.parse(cached[0].response_json) as GeocodeResult[] };
  }
  try {
    const results = await geocodeWithNominatim(address);
    const timestamp = nowIso();
    await execute(
      "INSERT OR REPLACE INTO geocoding_cache (id, cache_key, provider, response_json, created_at, updated_at, expires_at) VALUES (?, ?, 'nominatim', ?, ?, ?, NULL)",
      [createId("geo"), cacheKey, JSON.stringify(results), timestamp, timestamp]
    );
    return { ok: true, status: "fetched", message: `${results.length} address match${results.length === 1 ? "" : "es"} found.`, results };
  } catch (error) {
    return { ok: false, status: "error", message: error instanceof Error ? error.message : "Geocoding failed.", results: [] };
  }
}
