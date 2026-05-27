import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { normalizePlate, normalizePlateState } from "../../domain/vehicles/plateUtils";
import type { Vehicle, VehicleInput } from "../../../types/vehicle";
import type { NormalizedVehicleDecode } from "../../integrations/vinDecoder/vinDecoder.types";

export interface VehicleStats {
  totalVehicles: number;
  importedVehicles: number;
  recentVehicles: number;
  vehiclesWithServiceHistory: number;
}

export interface VehicleSearchResult extends Vehicle {
  customer_name: string | null;
  last_visit: string | null;
}

export type VehicleQuickFilter = "recent" | "imported" | "withHistory" | "openTickets";

export interface VehicleSearchFilters {
  recent?: boolean;
  imported?: boolean;
  withHistory?: boolean;
  openTickets?: boolean;
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

export async function findVehicleByVin(vin: string): Promise<Vehicle | null> {
  const normalizedVin = vin.trim().toUpperCase();
  if (!normalizedVin) return null;
  const rows = await query<Vehicle>(
    `SELECT * FROM vehicles
     WHERE deleted_at IS NULL
       AND UPPER(COALESCE(vin, '')) = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [normalizedVin]
  );
  return rows[0] ?? null;
}

export async function findVehicleByPlate(plate: string, state: string): Promise<Vehicle | null> {
  const normalizedPlate = normalizePlate(plate);
  const normalizedState = normalizePlateState(state);
  if (!normalizedPlate || !normalizedState) return null;
  const rows = await query<Vehicle>(
    `SELECT * FROM vehicles
     WHERE deleted_at IS NULL
       AND REPLACE(UPPER(COALESCE(plate, '')), ' ', '') = ?
       AND UPPER(COALESCE(plate_state, '')) = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [normalizedPlate, normalizedState]
  );
  return rows[0] ?? null;
}

export async function findVehiclesByPlatePartial(plate: string, state?: string | null, limit = 10): Promise<Vehicle[]> {
  const normalizedPlate = normalizePlate(plate);
  const normalizedState = normalizePlateState(state);
  if (!normalizedPlate) return [];
  const like = `%${normalizedPlate}%`;
  return query<Vehicle>(
    `SELECT * FROM vehicles
     WHERE deleted_at IS NULL
       AND REPLACE(UPPER(COALESCE(plate, '')), ' ', '') LIKE ?
       AND (? = '' OR UPPER(COALESCE(plate_state, '')) = ?)
     ORDER BY updated_at DESC
     LIMIT ?`,
    [like, normalizedState, normalizedState, limit]
  );
}

export async function findVehicleByVinOrPlate(input: { vin?: string | null; plate?: string | null; state?: string | null }): Promise<Vehicle | null> {
  if (input.vin?.trim()) {
    const match = await findVehicleByVin(input.vin);
    if (match) return match;
  }
  if (input.plate?.trim() && input.state?.trim()) {
    return findVehicleByPlate(input.plate, input.state);
  }
  return null;
}

export function normalizePlateFieldsBeforeSave<T extends { plate?: string | null; plate_state?: string | null }>(vehicle: T): T {
  const plate = normalizePlate(vehicle.plate);
  return {
    ...vehicle,
    plate: plate || null,
    plate_state: plate ? normalizePlateState(vehicle.plate_state) || null : null
  };
}

export async function getVehicleStats(): Promise<VehicleStats> {
  const [row] = await query<VehicleStats>(
    `SELECT
      COUNT(*) AS totalVehicles,
      COALESCE(SUM(CASE WHEN COALESCE(is_imported, 0) = 1 THEN 1 ELSE 0 END), 0) AS importedVehicles,
      COALESCE(SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END), 0) AS recentVehicles,
      COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM service_history h WHERE h.vehicle_id = vehicles.id AND h.deleted_at IS NULL) THEN 1 ELSE 0 END), 0) AS vehiclesWithServiceHistory
     FROM vehicles
     WHERE deleted_at IS NULL`,
    [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]
  );
  return row ?? { totalVehicles: 0, importedVehicles: 0, recentVehicles: 0, vehiclesWithServiceHistory: 0 };
}

function vehicleSearchWhere(search: string, filters: VehicleSearchFilters, params: unknown[]) {
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
      OR c.phone LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like);
  }
  if (filters.recent) {
    clauses.push("v.updated_at >= ?");
    params.push(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  }
  if (filters.imported) {
    clauses.push("COALESCE(v.is_imported, 0) = 1");
  }
  if (filters.withHistory) {
    clauses.push("EXISTS (SELECT 1 FROM service_history h WHERE h.vehicle_id = v.id AND h.deleted_at IS NULL)");
  }
  if (filters.openTickets) {
    clauses.push("EXISTS (SELECT 1 FROM tickets t WHERE t.vehicle_id = v.id AND t.deleted_at IS NULL AND t.status IN ('checked_in', 'in_service', 'waiting_payment'))");
  }
  return clauses.join(" AND ");
}

export async function searchVehiclesAdvanced(search = "", filters: VehicleSearchFilters = {}, limit = 50, offset = 0): Promise<VehicleSearchResult[]> {
  const params: unknown[] = [];
  const where = vehicleSearchWhere(search, filters, params);
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
  return searchVehiclesAdvanced("", { recent: true }, limit, 0);
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

export async function countVehicleSearchResults(search = "", filters: VehicleSearchFilters = {}): Promise<number> {
  const params: unknown[] = [];
  const where = vehicleSearchWhere(search, filters, params);
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
      id, customer_id, vin, plate, plate_state, year, make, model, trim, sub_model,
      engine_model, drive_type, fuel_type, transmission_style, mileage, oil_type,
      notes, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      id,
      input.customer_id,
      input.vin?.trim().toUpperCase() || null,
      normalizePlate(input.plate) || null,
      input.plate ? normalizePlateState(input.plate_state) || null : null,
      input.year,
      input.make,
      input.model,
      input.trim ?? null,
      input.sub_model ?? input.trim ?? null,
      input.engine_model ?? null,
      input.drive_type ?? null,
      input.fuel_type ?? null,
      input.transmission_style ?? null,
      input.mileage,
      input.oil_type,
      input.notes,
      timestamp,
      timestamp
    ]
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
      trim = ?, sub_model = ?, engine_model = ?, drive_type = ?, fuel_type = ?, transmission_style = ?,
      mileage = ?, oil_type = ?, notes = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.customer_id ?? current.customer_id,
      input.vin !== undefined ? input.vin?.trim().toUpperCase() || null : current.vin,
      input.plate !== undefined ? normalizePlate(input.plate) || null : current.plate,
      input.plate_state !== undefined ? normalizePlateState(input.plate_state) || null : current.plate_state,
      input.year ?? current.year,
      input.make ?? current.make,
      input.model ?? current.model,
      input.trim !== undefined ? input.trim : current.trim,
      input.sub_model !== undefined ? input.sub_model : current.sub_model,
      input.engine_model !== undefined ? input.engine_model : current.engine_model,
      input.drive_type !== undefined ? input.drive_type : current.drive_type,
      input.fuel_type !== undefined ? input.fuel_type : current.fuel_type,
      input.transmission_style !== undefined ? input.transmission_style : current.transmission_style,
      input.mileage ?? current.mileage,
      input.oil_type ?? current.oil_type,
      input.notes ?? current.notes,
      nowIso(),
      id
    ]
  );
}

export async function updateVehicleMileage(vehicleId: string, mileage: number): Promise<void> {
  await execute(
    `UPDATE vehicles SET mileage = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [mileage, nowIso(), vehicleId]
  );
}

export async function createVehicleForCustomer(customerId: string, vehicleDraft: Omit<VehicleInput, "customer_id">): Promise<Vehicle> {
  return createVehicle({ ...vehicleDraft, customer_id: customerId });
}

export async function linkVehicleToCustomer(vehicleId: string, customerId: string): Promise<void> {
  await execute(
    `UPDATE vehicles SET customer_id = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [customerId, nowIso(), vehicleId]
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
  air_filter_sku: string | null;
  cabin_filter_sku: string | null;
  vehicle_info_notes: string | null;
  vehicle_info_source_url: string | null;
  vehicle_info_source_title: string | null;
  vehicle_info_verified_at: string | null;
  vehicle_info_verified_by_employee_id: string | null;
  last_oil_change_date: string | null;
  last_oil_change_mileage: number | null;
}

export async function getVehicleServiceDefaults(vehicleId: string): Promise<VehicleServiceDefaults | null> {
  const rows = await query<VehicleServiceDefaults>(
    `SELECT oil_type, oil_capacity, oil_filter_sku, oil_filter_inventory_item_id,
      air_filter_sku, cabin_filter_sku, vehicle_info_notes, vehicle_info_source_url,
      vehicle_info_source_title, vehicle_info_verified_at, vehicle_info_verified_by_employee_id,
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
      air_filter_sku = COALESCE(?, air_filter_sku),
      cabin_filter_sku = COALESCE(?, cabin_filter_sku),
      vehicle_info_notes = COALESCE(?, vehicle_info_notes),
      vehicle_info_source_url = COALESCE(?, vehicle_info_source_url),
      vehicle_info_source_title = COALESCE(?, vehicle_info_source_title),
      vehicle_info_verified_at = COALESCE(?, vehicle_info_verified_at),
      vehicle_info_verified_by_employee_id = COALESCE(?, vehicle_info_verified_by_employee_id),
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
      defaults.air_filter_sku ?? null,
      defaults.cabin_filter_sku ?? null,
      defaults.vehicle_info_notes ?? null,
      defaults.vehicle_info_source_url ?? null,
      defaults.vehicle_info_source_title ?? null,
      defaults.vehicle_info_verified_at ?? null,
      defaults.vehicle_info_verified_by_employee_id ?? null,
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

export async function applyVehicleDecode(vehicleId: string, decode: NormalizedVehicleDecode, overwrite = false): Promise<void> {
  const current = await getVehicle(vehicleId);
  if (!current) throw new Error("Vehicle not found.");
  const pick = <T>(next: T | null | undefined, existing: T | null | undefined) => overwrite ? next ?? existing ?? null : existing ?? next ?? null;
  await execute(
    `UPDATE vehicles SET
      year = ?, make = ?, model = ?, trim = ?, series = ?, body_class = ?, vehicle_type = ?,
      doors = ?, drive_type = ?, fuel_type = ?, engine_cylinders = ?, engine_displacement_l = ?,
      engine_displacement_cc = ?, engine_model = ?, engine_configuration = ?, manufacturer = ?,
      plant_country = ?, plant_state = ?, transmission_style = ?, gvwr = ?, brake_system_type = ?,
      vin_decoded_at = ?, vin_decode_source = ?, vin_decode_confidence = ?,
      vin_decode_raw_json = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      pick(decode.year, current.year),
      pick(decode.make, current.make),
      pick(decode.model, current.model),
      pick(decode.trim, current.trim),
      pick(decode.series, current.series),
      pick(decode.bodyClass, current.body_class),
      pick(decode.vehicleType, current.vehicle_type),
      pick(decode.doors, current.doors),
      pick(decode.driveType, current.drive_type),
      pick(decode.fuelType, current.fuel_type),
      pick(decode.engineCylinders, current.engine_cylinders),
      pick(decode.engineDisplacementL, current.engine_displacement_l),
      pick(decode.engineDisplacementCc, current.engine_displacement_cc),
      pick(decode.engineModel, current.engine_model),
      pick(decode.engineConfiguration, current.engine_configuration),
      pick(decode.manufacturer, current.manufacturer),
      pick(decode.plantCountry, current.plant_country),
      pick(decode.plantState, current.plant_state),
      pick(decode.transmissionStyle, current.transmission_style),
      pick(decode.gvwr, current.gvwr),
      pick(decode.brakeSystemType, current.brake_system_type),
      decode.decodedAt,
      decode.source,
      decode.confidence,
      JSON.stringify(decode.raw ?? null),
      nowIso(),
      vehicleId
    ]
  );
}
