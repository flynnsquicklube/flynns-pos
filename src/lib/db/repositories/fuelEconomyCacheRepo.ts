import { execute, query } from "../sqlite";
import { nowIso } from "../../utils/dates";
import { createId } from "../../utils/ids";

export interface FuelEconomyCacheRow {
  id: string;
  cache_key: string;
  provider: string;
  response_json: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export async function getFuelEconomyCache<T>(cacheKey: string): Promise<T | null> {
  const rows = await query<FuelEconomyCacheRow>(
    "SELECT * FROM fuel_economy_cache WHERE cache_key = ? AND (expires_at IS NULL OR expires_at > ?)",
    [cacheKey, nowIso()]
  );
  const row = rows[0];
  if (!row) return null;
  try {
    return JSON.parse(row.response_json) as T;
  } catch {
    return null;
  }
}

export async function saveFuelEconomyCache(cacheKey: string, response: unknown, expiresAt: string | null = null): Promise<void> {
  const timestamp = nowIso();
  const existing = await query<FuelEconomyCacheRow>("SELECT id FROM fuel_economy_cache WHERE cache_key = ?", [cacheKey]);
  if (existing[0]) {
    await execute(
      "UPDATE fuel_economy_cache SET response_json = ?, updated_at = ?, expires_at = ? WHERE cache_key = ?",
      [JSON.stringify(response), timestamp, expiresAt, cacheKey]
    );
    return;
  }
  await execute(
    "INSERT INTO fuel_economy_cache (id, cache_key, provider, response_json, created_at, updated_at, expires_at) VALUES (?, ?, 'epa_fueleconomy', ?, ?, ?, ?)",
    [createId("epa"), cacheKey, JSON.stringify(response), timestamp, timestamp, expiresAt]
  );
}

export async function countFuelEconomyCache(): Promise<number> {
  const [row] = await query<{ count: number }>("SELECT COUNT(*) AS count FROM fuel_economy_cache", []);
  return row?.count ?? 0;
}

export async function clearFuelEconomyCache(): Promise<void> {
  await execute("DELETE FROM fuel_economy_cache", []);
}
