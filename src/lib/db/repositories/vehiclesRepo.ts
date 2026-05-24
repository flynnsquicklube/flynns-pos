import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { Vehicle, VehicleInput } from "../../../types/vehicle";

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

export async function updateVehicleAfterService(vehicleId: string, mileage: number, oilType: string | null): Promise<void> {
  await execute("UPDATE vehicles SET mileage = ?, oil_type = COALESCE(?, oil_type), updated_at = ?, sync_status = 'pending' WHERE id = ?", [
    mileage,
    oilType,
    nowIso(),
    vehicleId
  ]);
}
