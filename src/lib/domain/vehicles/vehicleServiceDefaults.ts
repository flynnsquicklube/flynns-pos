import { query } from "../../db/sqlite";
import { getVehicleById, getVehicleServiceDefaults } from "../../db/repositories/vehiclesRepo";
import { suggestOilFilter, type OilFilterSuggestion } from "../services/oilFilterSuggestion";
import type { Vehicle } from "../../../types/vehicle";

export interface VehicleServiceDefaultsResult {
  vehicle: Vehicle | null;
  oilType: string | null;
  suggestedQuarts: number | null;
  quartsSource: "vehicle_default" | "last_service" | "package_default";
  lastOilChangeDate: string | null;
  lastOilChangeMileage: number | null;
  oilFilter: OilFilterSuggestion;
}

async function getLastPackageQuarts(vehicleId: string): Promise<number | null> {
  const rows = await query<{ actual_quarts: number }>(
    `SELECT tpd.actual_quarts
     FROM ticket_package_details tpd
     JOIN tickets t ON t.id = tpd.ticket_id
     WHERE t.vehicle_id = ?
       AND t.deleted_at IS NULL
       AND tpd.deleted_at IS NULL
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC
     LIMIT 1`,
    [vehicleId]
  );
  return rows[0]?.actual_quarts ?? null;
}

export async function getVehicleOilChangeDefaults(vehicleId: string | null, packageIncludedQuarts?: number): Promise<VehicleServiceDefaultsResult> {
  if (!vehicleId) {
    return {
      vehicle: null,
      oilType: null,
      suggestedQuarts: packageIncludedQuarts ?? null,
      quartsSource: "package_default",
      lastOilChangeDate: null,
      lastOilChangeMileage: null,
      oilFilter: { source: "none", confidence: "none", message: "No saved filter found." }
    };
  }

  const vehicle = await getVehicleById(vehicleId);
  const defaults = await getVehicleServiceDefaults(vehicleId);
  const lastPackageQuarts = await getLastPackageQuarts(vehicleId);
  const oilFilter = await suggestOilFilter(vehicle);
  return {
    vehicle,
    oilType: defaults?.oil_type ?? vehicle?.oil_type ?? null,
    suggestedQuarts: defaults?.oil_capacity ?? lastPackageQuarts ?? packageIncludedQuarts ?? null,
    quartsSource: defaults?.oil_capacity ? "vehicle_default" : lastPackageQuarts ? "last_service" : "package_default",
    lastOilChangeDate: defaults?.last_oil_change_date ?? null,
    lastOilChangeMileage: defaults?.last_oil_change_mileage ?? null,
    oilFilter
  };
}
