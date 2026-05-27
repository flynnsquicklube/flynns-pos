import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { VehicleServiceDefaults } from "./vehiclesRepo";

export interface VehicleInfoLookupHistoryInput {
  vehicle_id?: string | null;
  vin?: string | null;
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  query: string;
  provider: string;
  source_url?: string | null;
  source_title?: string | null;
  suggested_json?: unknown;
  selected_json?: unknown;
  status?: "searched" | "reviewed" | "saved" | "discarded" | "failed";
  employee_id?: string | null;
}

export interface VehicleInfoLookupHistoryRow {
  id: string;
  vehicle_id: string | null;
  vin: string | null;
  year: string | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  query: string;
  provider: string;
  source_url: string | null;
  source_title: string | null;
  suggested_json: string | null;
  selected_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  employee_id: string | null;
}

export interface VehicleInfoDefaultsInput {
  oil_type?: string | null;
  oil_capacity?: number | null;
  oil_filter_sku?: string | null;
  oil_filter_inventory_item_id?: string | null;
  air_filter_sku?: string | null;
  cabin_filter_sku?: string | null;
  vehicle_info_notes?: string | null;
  vehicle_info_source_url?: string | null;
  vehicle_info_source_title?: string | null;
  vehicle_info_verified_by_employee_id?: string | null;
}

export async function saveLookupHistory(input: VehicleInfoLookupHistoryInput): Promise<VehicleInfoLookupHistoryRow> {
  const id = createId("vinfo");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO vehicle_info_lookup_history (
      id, vehicle_id, vin, year, make, model, engine, query, provider, source_url,
      source_title, suggested_json, selected_json, status, created_at, updated_at, employee_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicle_id ?? null,
      input.vin ?? null,
      input.year == null ? null : String(input.year),
      input.make ?? null,
      input.model ?? null,
      input.engine ?? null,
      input.query,
      input.provider,
      input.source_url ?? null,
      input.source_title ?? null,
      input.suggested_json === undefined ? null : JSON.stringify(input.suggested_json),
      input.selected_json === undefined ? null : JSON.stringify(input.selected_json),
      input.status ?? "reviewed",
      timestamp,
      timestamp,
      input.employee_id ?? null
    ]
  );
  const [row] = await query<VehicleInfoLookupHistoryRow>("SELECT * FROM vehicle_info_lookup_history WHERE id = ?", [id]);
  if (!row) throw new Error("Vehicle info lookup history was not saved.");
  return row;
}

export async function listLookupHistoryByVehicle(vehicleId: string): Promise<VehicleInfoLookupHistoryRow[]> {
  return query<VehicleInfoLookupHistoryRow>(
    `SELECT * FROM vehicle_info_lookup_history
     WHERE vehicle_id = ?
     ORDER BY created_at DESC
     LIMIT 25`,
    [vehicleId]
  );
}

export async function getVehicleInfoDefaults(vehicleId: string): Promise<VehicleServiceDefaults | null> {
  const [row] = await query<VehicleServiceDefaults>(
    `SELECT oil_type, oil_capacity, oil_filter_sku, oil_filter_inventory_item_id,
      air_filter_sku, cabin_filter_sku, vehicle_info_notes, vehicle_info_source_url,
      vehicle_info_source_title, vehicle_info_verified_at, vehicle_info_verified_by_employee_id,
      last_oil_change_date, last_oil_change_mileage
     FROM vehicles
     WHERE id = ? AND deleted_at IS NULL`,
    [vehicleId]
  );
  return row ?? null;
}

export async function saveVehicleInfoDefaults(vehicleId: string, defaults: VehicleInfoDefaultsInput): Promise<void> {
  const timestamp = nowIso();
  await execute(
    `UPDATE vehicles SET
      oil_type = ?,
      oil_capacity = ?,
      oil_filter_sku = ?,
      oil_filter_inventory_item_id = ?,
      air_filter_sku = ?,
      cabin_filter_sku = ?,
      vehicle_info_notes = ?,
      vehicle_info_source_url = ?,
      vehicle_info_source_title = ?,
      vehicle_info_verified_at = ?,
      vehicle_info_verified_by_employee_id = ?,
      updated_at = ?,
      sync_status = 'pending'
     WHERE id = ?`,
    [
      defaults.oil_type ?? null,
      defaults.oil_capacity ?? null,
      defaults.oil_filter_sku ?? null,
      defaults.oil_filter_inventory_item_id ?? null,
      defaults.air_filter_sku ?? null,
      defaults.cabin_filter_sku ?? null,
      defaults.vehicle_info_notes ?? null,
      defaults.vehicle_info_source_url ?? null,
      defaults.vehicle_info_source_title ?? null,
      timestamp,
      defaults.vehicle_info_verified_by_employee_id ?? null,
      timestamp,
      vehicleId
    ]
  );
}

export async function getCachedVehicleInfoSearch(queryText: string, provider: string): Promise<unknown | null> {
  const [row] = await query<{ response_json: string; expires_at: string | null }>(
    `SELECT response_json, expires_at FROM vehicle_info_search_cache
     WHERE query = ? AND provider = ?
     LIMIT 1`,
    [queryText, provider]
  );
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  try {
    return JSON.parse(row.response_json);
  } catch {
    return null;
  }
}

export async function saveVehicleInfoSearchCache(queryText: string, provider: string, response: unknown, expiresAt?: string | null): Promise<void> {
  const timestamp = nowIso();
  const existing = await query<{ id: string }>("SELECT id FROM vehicle_info_search_cache WHERE query = ? AND provider = ?", [queryText, provider]);
  if (existing[0]) {
    await execute(
      `UPDATE vehicle_info_search_cache SET response_json = ?, created_at = ?, expires_at = ? WHERE id = ?`,
      [JSON.stringify(response), timestamp, expiresAt ?? null, existing[0].id]
    );
    return;
  }
  await execute(
    `INSERT INTO vehicle_info_search_cache (id, query, provider, response_json, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId("vsearch"), queryText, provider, JSON.stringify(response), timestamp, expiresAt ?? null]
  );
}
