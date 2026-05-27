import { getVehicleById } from "../../db/repositories/vehiclesRepo";
import { getOilChangeHistoryByVehicle, getLastOilFilterForVehicle } from "../../db/repositories/serviceHistoryRepo";
import { getVehicleInfoDefaults, listLookupHistoryByVehicle } from "../../db/repositories/vehicleInfoLookupRepo";
import { getOilCapacity, getOilFilters, getAirFilters, getCabinFilters } from "../parts/partFitment.service";
import { decodeVinWithFallback } from "../vinDecoder/vinDecoder.service";
import { buildManualVehicleInfoSearchLinks } from "./manualWebSearch.provider";
import { searchVehicleInfoWithGoogle, getGoogleVehicleInfoSearchStatus } from "./googleProgrammableSearch.provider";
import type { ManualSearchLink, VehicleInfoLookupContext, VehicleInfoLookupResult } from "./vehicleInfo.types";

export interface LocalHistoryVehicleInfo {
  lastOilChangeDate: string | null;
  lastMileage: number | null;
  lastOilType: string | null;
  lastActualQuarts: number | null;
  lastOilFilterSku: string | null;
  lastOilFilterName: string | null;
  previousFilters: Array<{ sku: string | null; name: string | null; source: string }>;
  previousOilTypes: string[];
  confidence: "high" | "medium" | "low";
  source: string;
}

function toYear(value: string | number | null | undefined): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

export async function getLocalVehicleInfo(context: VehicleInfoLookupContext): Promise<LocalHistoryVehicleInfo> {
  const vehicleId = context.vehicleId ?? context.vehicle?.id ?? null;
  const vehicle = vehicleId ? await getVehicleById(vehicleId).catch(() => null) : null;
  const year = toYear(context.year ?? vehicle?.year);
  const [history, lastFilter, defaults, capacity, filters, airFilters, cabinFilters] = await Promise.all([
    vehicleId ? getOilChangeHistoryByVehicle(vehicleId, 8).catch(() => []) : Promise.resolve([]),
    vehicleId ? getLastOilFilterForVehicle(vehicleId).catch(() => null) : Promise.resolve(null),
    vehicleId ? getVehicleInfoDefaults(vehicleId).catch(() => null) : Promise.resolve(null),
    getOilCapacity({ vehicleId, vin: context.vin ?? vehicle?.vin, year, make: context.make ?? vehicle?.make, model: context.model ?? vehicle?.model, engine: context.engine ?? vehicle?.engine_model }).catch(() => null),
    getOilFilters({ vehicleId, vin: context.vin ?? vehicle?.vin, year, make: context.make ?? vehicle?.make, model: context.model ?? vehicle?.model, engine: context.engine ?? vehicle?.engine_model }).catch(() => null),
    getAirFilters({ vehicleId, vin: context.vin ?? vehicle?.vin, year, make: context.make ?? vehicle?.make, model: context.model ?? vehicle?.model, engine: context.engine ?? vehicle?.engine_model }).catch(() => null),
    getCabinFilters({ vehicleId, vin: context.vin ?? vehicle?.vin, year, make: context.make ?? vehicle?.make, model: context.model ?? vehicle?.model, engine: context.engine ?? vehicle?.engine_model }).catch(() => null)
  ]);
  const lastHistory = history[0] ?? null;
  let parsedPackage: { actual_quarts?: number; oil_type?: string } | null = null;
  if (lastHistory?.services_json) {
    try {
      parsedPackage = (JSON.parse(lastHistory.services_json) as { packageDetails?: { actual_quarts?: number; oil_type?: string } }).packageDetails ?? null;
    } catch {
      parsedPackage = null;
    }
  }
  const previousOilTypes = Array.from(new Set([
    defaults?.oil_type,
    vehicle?.oil_type,
    ...history.map((entry) => entry.oil_type),
    parsedPackage?.oil_type
  ].filter((value): value is string => Boolean(value))));
  const previousFilters = [
    ...((filters?.parts ?? []).map((part) => ({ sku: part.sku ?? part.productId ?? null, name: part.name ?? null, source: part.source }))),
    ...(airFilters?.parts ?? []).map((part) => ({ sku: part.sku ?? part.productId ?? null, name: part.name ?? null, source: part.source })),
    ...(cabinFilters?.parts ?? []).map((part) => ({ sku: part.sku ?? part.productId ?? null, name: part.name ?? null, source: part.source }))
  ];
  const lastActualQuarts = defaults?.oil_capacity ?? parsedPackage?.actual_quarts ?? Number(capacity?.specs?.[0]?.value ?? NaN);
  return {
    lastOilChangeDate: defaults?.last_oil_change_date ?? lastHistory?.service_date ?? null,
    lastMileage: defaults?.last_oil_change_mileage ?? lastHistory?.mileage ?? vehicle?.mileage ?? null,
    lastOilType: previousOilTypes[0] ?? null,
    lastActualQuarts: Number.isFinite(lastActualQuarts) ? Number(lastActualQuarts) : null,
    lastOilFilterSku: defaults?.oil_filter_sku ?? lastFilter?.sku ?? filters?.parts?.[0]?.sku ?? filters?.parts?.[0]?.productId ?? null,
    lastOilFilterName: lastFilter?.name ?? filters?.parts?.[0]?.name ?? null,
    previousFilters,
    previousOilTypes,
    confidence: defaults?.oil_capacity || defaults?.oil_filter_sku ? "high" : history.length ? "medium" : "low",
    source: defaults?.oil_capacity || defaults?.oil_filter_sku ? "vehicle_defaults" : history.length ? "local_service_history" : "local_inventory"
  };
}

export async function getVinVehicleData(context: VehicleInfoLookupContext) {
  if (!context.vin) return null;
  return decodeVinWithFallback(context.vin, { modelYear: context.year ?? null });
}

export function getManualVehicleInfoSearchLinks(context: VehicleInfoLookupContext): ManualSearchLink[] {
  return buildManualVehicleInfoSearchLinks(context);
}

export async function searchWebVehicleInfo(queryText: string): Promise<{ ok: boolean; message: string; results: VehicleInfoLookupResult[] }> {
  return searchVehicleInfoWithGoogle(queryText);
}

export async function getVehicleInfoLookupStatus() {
  return getGoogleVehicleInfoSearchStatus();
}

export async function getVehicleInfoLookupHistory(vehicleId: string | null | undefined) {
  return vehicleId ? listLookupHistoryByVehicle(vehicleId) : [];
}
