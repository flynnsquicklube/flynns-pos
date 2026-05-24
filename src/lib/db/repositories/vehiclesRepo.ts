import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { Vehicle, VehicleInput } from "../../../types/vehicle";

export interface VehicleStats {
  totalVehicles: number;
  importedVehicles: number;
  recentVehicles: number;
}

export interface VehicleSearchResult extends Vehicle {
  customer_name: string | null;
  last_visit: string | null;
}

export async function listVehicles(search = ""): Promise<Vehicle[]> {
  const like = `%${search.trim()}%`;
  return query<Vehicle>(
    `SELECT * FROM vehicles
     WHERE deleted_at IS NULL
       AND (? = '%%' OR vin LIKE ? OR plate LIKE ? OR make LIKE ? OR model LIKE ?)
     ORDER BY updated_at DESC`,
    [like, like, like, like, like]
  );
}

export async function searchVehicles(search = "", customerId?: string): Promise<Vehicle[]> {
  const like = `%${search.trim()}%`;
  return query<Vehicle>(
    `SELECT * FROM vehicles
     WHERE deleted_at IS NULL
       AND (? IS NULL OR customer_id = ?)
       AND (? = '%%' OR vin LIKE ? OR plate LIKE ? OR CAST(year AS TEXT) LIKE ? OR make LIKE ? OR model LIKE ?)
     ORDER BY updated_at DESC`,
    [customerId ?? null, customerId ?? null, like, like, like, like, like, like]
  );
}

export async function getVehicleStats(): Promise<VehicleStats> {
  const [row] = await query<VehicleStats>(
    `SELECT
      COUNT(*) AS totalVehicles,
      COALESCE(SUM(CASE WHEN COALESCE(is_imported, 0) = 1 THEN 1 ELSE 0 END), 0) AS importedVehicles,
      COALESCE(SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END), 0) AS recentVehicles
     FROM vehicles
     WHERE deleted_at IS NULL`,
    [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]
  );
  return row ?? { totalVehicles: 0, importedVehicles: 0, recentVehicles: 0 };
}

function vehicleSearchWhere(search: string, params: unknown[]) {
  const clauses = ["v.deleted_at IS NULL"];
  const trimmed = search.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    clauses.push(`(
      v.vin LIKE ?
      OR v.plate LIKE ?
      OR CAST(v.year AS TEXT) LIKE ?
      OR v.make LIKE ?
      OR v.model LIKE ?
      OR c.first_name LIKE ?
      OR c.last_name LIKE ?
      OR (c.first_name || ' ' || c.last_name) LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }
  return clauses.join(" AND ");
}

export async function searchVehiclesAdvanced(search = "", limit = 50, offset = 0): Promise<VehicleSearchResult[]> {
  const params: unknown[] = [];
  const where = vehicleSearchWhere(search, params);
  params.push(limit, offset);
  return query<VehicleSearchResult>(
    `SELECT v.*, (c.first_name || ' ' || c.last_name) AS customer_name,
      (SELECT MAX(COALESCE(t.completed_at, t.created_at)) FROM tickets t WHERE t.vehicle_id = v.id AND t.deleted_at IS NULL) AS last_visit
     FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id
     WHERE ${where}
     ORDER BY COALESCE(last_visit, v.updated_at) DESC
     LIMIT ? OFFSET ?`,
    params
  );
}

export async function listRecentVehicles(limit = 10): Promise<VehicleSearchResult[]> {
  return searchVehiclesAdvanced("", limit, 0);
}

export async function listVehiclesByCustomerId(customerId: string): Promise<VehicleSearchResult[]> {
  return query<VehicleSearchResult>(
    `SELECT v.*, (c.first_name || ' ' || c.last_name) AS customer_name,
      (SELECT MAX(COALESCE(t.completed_at, t.created_at)) FROM tickets t WHERE t.vehicle_id = v.id AND t.deleted_at IS NULL) AS last_visit
     FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id
     WHERE v.deleted_at IS NULL AND v.customer_id = ?
     ORDER BY COALESCE(last_visit, v.updated_at) DESC`,
    [customerId]
  );
}

export async function countVehicleSearchResults(search = ""): Promise<number> {
  const params: unknown[] = [];
  const where = vehicleSearchWhere(search, params);
  const [row] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE ${where}`,
    params
  );
  return row?.count ?? 0;
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const rows = await query<Vehicle>("SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export const getVehicleById = getVehicle;

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  const id = createId("veh");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO vehicles (
      id, customer_id, vin, plate, plate_state, year, make, model, mileage, oil_type,
      notes, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.customer_id, input.vin, input.plate, input.plate_state, input.year, input.make, input.model, input.mileage, input.oil_type, input.notes, timestamp, timestamp]
  );
  const vehicle = await getVehicle(id);
  if (!vehicle) throw new Error("Vehicle was not created.");
  return vehicle;
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>): Promise<void> {
  const current = await getVehicle(id);
  if (!current) throw new Error("Vehicle not found.");
  await execute(
    `UPDATE vehicles SET
      customer_id = ?, vin = ?, plate = ?, plate_state = ?, year = ?, make = ?, model = ?,
      mileage = ?, oil_type = ?, notes = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.customer_id ?? current.customer_id,
      input.vin ?? current.vin,
      input.plate ?? current.plate,
      input.plate_state ?? current.plate_state,
      input.year ?? current.year,
      input.make ?? current.make,
      input.model ?? current.model,
      input.mileage ?? current.mileage,
      input.oil_type ?? current.oil_type,
      input.notes ?? current.notes,
      nowIso(),
      id
    ]
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  await execute("UPDATE vehicles SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), nowIso(), id]);
}

export interface VehicleServiceDefaults {
  oil_type: string | null;
  oil_capacity: number | null;
  oil_filter_sku: string | null;
  oil_filter_inventory_item_id: string | null;
  last_oil_change_date: string | null;
  last_oil_change_mileage: number | null;
}

export async function getVehicleServiceDefaults(vehicleId: string): Promise<VehicleServiceDefaults | null> {
  const rows = await query<VehicleServiceDefaults>(
    `SELECT oil_type, oil_capacity, oil_filter_sku, oil_filter_inventory_item_id,
      last_oil_change_date, last_oil_change_mileage
     FROM vehicles
     WHERE id = ? AND deleted_at IS NULL`,
    [vehicleId]
  );
  return rows[0] ?? null;
}

export async function updateVehicleServiceDefaults(vehicleId: string, defaults: Partial<VehicleServiceDefaults>): Promise<void> {
  const current = await getVehicle(vehicleId);
  if (!current) throw new Error("Vehicle not found.");
  await execute(
    `UPDATE vehicles SET
      oil_type = COALESCE(?, oil_type),
      oil_capacity = COALESCE(?, oil_capacity),
      oil_filter_sku = COALESCE(?, oil_filter_sku),
      oil_filter_inventory_item_id = COALESCE(?, oil_filter_inventory_item_id),
      last_oil_change_date = COALESCE(?, last_oil_change_date),
      last_oil_change_mileage = COALESCE(?, last_oil_change_mileage),
      updated_at = ?,
      sync_status = 'pending'
     WHERE id = ?`,
    [
      defaults.oil_type ?? null,
      defaults.oil_capacity ?? null,
      defaults.oil_filter_sku ?? null,
      defaults.oil_filter_inventory_item_id ?? null,
      defaults.last_oil_change_date ?? null,
      defaults.last_oil_change_mileage ?? null,
      nowIso(),
      vehicleId
    ]
  );
}

export async function updateVehicleAfterService(
  vehicleId: string,
  mileage: number,
  oilType: string | null,
  defaults: Partial<Pick<VehicleServiceDefaults, "oil_capacity" | "oil_filter_sku" | "oil_filter_inventory_item_id">> = {}
): Promise<void> {
  const timestamp = nowIso();
  await execute(
    `UPDATE vehicles SET
      mileage = ?,
      oil_type = COALESCE(?, oil_type),
      oil_capacity = COALESCE(?, oil_capacity),
      oil_filter_sku = COALESCE(?, oil_filter_sku),
      oil_filter_inventory_item_id = COALESCE(?, oil_filter_inventory_item_id),
      last_oil_change_date = ?,
      last_oil_change_mileage = ?,
      updated_at = ?,
      sync_status = 'pending'
     WHERE id = ?`,
    [
      mileage,
      oilType,
      defaults.oil_capacity ?? null,
      defaults.oil_filter_sku ?? null,
      defaults.oil_filter_inventory_item_id ?? null,
      timestamp,
      mileage,
      timestamp,
      vehicleId
    ]
  );
}
