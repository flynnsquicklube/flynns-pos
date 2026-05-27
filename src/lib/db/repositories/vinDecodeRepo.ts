import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { NormalizedVehicleDecode } from "../../integrations/vinDecoder/vinDecoder.types";

export interface VinDecodeCacheRow {
  id: string;
  vin: string;
  provider: string;
  normalized_json: string;
  raw_json: string | null;
  confidence: string | null;
  decoded_at: string;
  created_at: string;
  updated_at: string;
}

export async function getCachedDecode(vin: string): Promise<NormalizedVehicleDecode | null> {
  const rows = await query<VinDecodeCacheRow>("SELECT * FROM vin_decode_cache WHERE vin = ?", [vin]);
  const row = rows[0];
  if (!row) return null;
  try {
    return { ...(JSON.parse(row.normalized_json) as NormalizedVehicleDecode), source: "local_cache" };
  } catch {
    return null;
  }
}

export async function saveCachedDecode(result: NormalizedVehicleDecode): Promise<void> {
  const existing = await query<VinDecodeCacheRow>("SELECT * FROM vin_decode_cache WHERE vin = ?", [result.vin]);
  const timestamp = nowIso();
  if (existing[0]) {
    await execute(
      "UPDATE vin_decode_cache SET provider = ?, normalized_json = ?, raw_json = ?, confidence = ?, decoded_at = ?, updated_at = ? WHERE vin = ?",
      [result.source, JSON.stringify(result), JSON.stringify(result.raw ?? null), result.confidence, result.decodedAt, timestamp, result.vin]
    );
    return;
  }
  await execute(
    `INSERT INTO vin_decode_cache (
      id, vin, provider, normalized_json, raw_json, confidence, decoded_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId("vin"), result.vin, result.source, JSON.stringify(result), JSON.stringify(result.raw ?? null), result.confidence, result.decodedAt, timestamp, timestamp]
  );
}

export async function clearDecodeCacheForVin(vin: string): Promise<void> {
  await execute("DELETE FROM vin_decode_cache WHERE vin = ?", [vin]);
}

export async function listRecentDecodes(limit = 20): Promise<VinDecodeCacheRow[]> {
  return query<VinDecodeCacheRow>("SELECT * FROM vin_decode_cache ORDER BY decoded_at DESC LIMIT ?", [limit]);
}
