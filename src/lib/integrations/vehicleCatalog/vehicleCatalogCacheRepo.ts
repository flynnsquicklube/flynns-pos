import { execute, query } from "../../db/sqlite";
import { nowIso } from "../../utils/dates";
import { createId } from "../../utils/ids";
import type { VehicleCatalogOption } from "./vehicleCatalog.types";

interface VehicleCatalogCacheRow {
  response_json: string;
  expires_at: string | null;
}

export async function getVehicleCatalogCache<T>(cacheKey: string): Promise<T | null> {
  const rows = await query<VehicleCatalogCacheRow>("SELECT response_json, expires_at FROM vehicle_catalog_cache WHERE cache_key = ?", [cacheKey]);
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  return JSON.parse(row.response_json) as T;
}

export async function saveVehicleCatalogCache(input: { provider: string; cacheType: string; cacheKey: string; response: unknown; expiresAt?: string | null }) {
  const timestamp = nowIso();
  const existing = await query<{ id: string }>("SELECT id FROM vehicle_catalog_cache WHERE cache_key = ?", [input.cacheKey]);
  if (existing[0]) {
    await execute(
      "UPDATE vehicle_catalog_cache SET provider = ?, cache_type = ?, response_json = ?, updated_at = ?, expires_at = ? WHERE cache_key = ?",
      [input.provider, input.cacheType, JSON.stringify(input.response), timestamp, input.expiresAt ?? null, input.cacheKey]
    );
    return;
  }
  await execute(
    `INSERT INTO vehicle_catalog_cache (id, provider, cache_type, cache_key, response_json, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId("vcache"), input.provider, input.cacheType, input.cacheKey, JSON.stringify(input.response), timestamp, timestamp, input.expiresAt ?? null]
  );
}

export async function saveVehicleCatalogOptions(options: VehicleCatalogOption[]) {
  const timestamp = nowIso();
  for (const option of options) {
    const existing = await query<{ id: string }>("SELECT id FROM vehicle_catalog_options WHERE provider = ? AND provider_option_id = ?", [option.source, option.id]);
    const values = [
      option.source,
      option.id,
      option.year,
      option.make,
      option.model,
      option.trim,
      option.engine,
      option.displacement,
      option.cylinders,
      option.transmission,
      option.drive,
      option.fuelType,
      option.bodyClass,
      JSON.stringify(option.raw),
      timestamp
    ];
    if (existing[0]) {
      await execute(
        `UPDATE vehicle_catalog_options SET provider = ?, provider_option_id = ?, year = ?, make = ?, model = ?, trim = ?,
          engine = ?, displacement = ?, cylinders = ?, transmission = ?, drive = ?, fuel_type = ?, body_class = ?,
          raw_json = ?, updated_at = ? WHERE id = ?`,
        [...values, existing[0].id]
      );
    } else {
      await execute(
        `INSERT INTO vehicle_catalog_options (
          id, provider, provider_option_id, year, make, model, trim, engine, displacement, cylinders,
          transmission, drive, fuel_type, body_class, raw_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [createId("vopt"), ...values, timestamp]
      );
    }
  }
}
