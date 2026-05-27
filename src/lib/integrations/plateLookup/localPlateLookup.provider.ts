import { findVehicleByPlate } from "../../db/repositories/vehiclesRepo";
import { normalizePlate, normalizePlateState } from "../../domain/vehicles/plateUtils";
import type { PlateLookupProvider, PlateLookupRequest, PlateLookupResult } from "./plateLookup.types";

export const localPlateLookupProvider: PlateLookupProvider = {
  id: "local_sqlite_plate_lookup",
  async lookupPlate(request: PlateLookupRequest): Promise<PlateLookupResult> {
    const plate = normalizePlate(request.plate);
    const state = normalizePlateState(request.state);
    const vehicle = await findVehicleByPlate(plate, state);
    if (!vehicle) {
      return {
        status: "not_found",
        plate,
        state,
        source: "local_sqlite",
        confidence: "none",
        message: `No local vehicle found for ${plate} ${state}.`
      };
    }
    return {
      status: "found",
      vin: vehicle.vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim ?? null,
      engine: vehicle.engine_model ?? null,
      plate: vehicle.plate ?? plate,
      state: vehicle.plate_state ?? state,
      source: "local_sqlite",
      confidence: "high",
      vehicleId: vehicle.id,
      customerId: vehicle.customer_id,
      raw: vehicle
    };
  }
};
