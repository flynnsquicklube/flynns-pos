import { query } from "../../db/sqlite";
import { getVehicleById, getVehicleServiceDefaults as getSavedVehicleServiceDefaults } from "../../db/repositories/vehiclesRepo";
import { getOilChangeHistoryByVehicle } from "../../db/repositories/serviceHistoryRepo";
import { getLastCompletedTicketPackageDetailsByVehicle } from "../../db/repositories/ticketsRepo";
import { suggestOilFilter, type OilFilterSuggestion } from "../services/oilFilterSuggestion";
import type { Vehicle } from "../../../types/vehicle";
import type { TicketPackageDetails } from "../../../types/servicePackage";

export type VehicleServiceDefaultSource =
  | "saved_vehicle_default"
  | "service_history"
  | "previous_ticket"
  | "imported_droptop"
  | "fallback_match"
  | "package_default"
  | "no_data";

export type VehicleServiceDefaultConfidence = "high" | "medium" | "low" | "none";

export interface PreviousOilServiceSuggestion {
  found: boolean;
  source: VehicleServiceDefaultSource;
  confidence: VehicleServiceDefaultConfidence;
  lastServiceDate: string | null;
  lastServiceMileage: number | null;
  packageId: string | null;
  packageName: string | null;
  oilBrand: string | null;
  oilType: string | null;
  viscosity: string | null;
  includedQuarts: number | null;
  actualQuarts: number | null;
  oilInventoryItemId: string | null;
  oilSku: string | null;
  oilName: string | null;
  filterInventoryItemId: string | null;
  filterSku: string | null;
  filterName: string | null;
  filterRetailPrice: number | null;
  sourceLabel: string;
}

export interface VehicleServiceDefaultsResult {
  vehicle: Vehicle | null;
  oilType: string | null;
  suggestedQuarts: number | null;
  quartsSource: "vehicle_default" | "last_service" | "package_default";
  lastOilChangeDate: string | null;
  lastOilChangeMileage: number | null;
  oilFilter: OilFilterSuggestion;
  previousService: PreviousOilServiceSuggestion;
}

function sourceLabel(source: VehicleServiceDefaultSource) {
  switch (source) {
    case "saved_vehicle_default": return "Saved vehicle defaults";
    case "service_history": return "Previous service history";
    case "previous_ticket": return "Previous ticket";
    case "imported_droptop": return "Imported Droptop history";
    case "fallback_match": return "Similar vehicle history";
    case "package_default": return "Selected package";
    case "no_data": return "No previous service data";
  }
}

function noPreviousService(): PreviousOilServiceSuggestion {
  return {
    found: false,
    source: "no_data",
    confidence: "none",
    lastServiceDate: null,
    lastServiceMileage: null,
    packageId: null,
    packageName: null,
    oilBrand: null,
    oilType: null,
    viscosity: null,
    includedQuarts: null,
    actualQuarts: null,
    oilInventoryItemId: null,
    oilSku: null,
    oilName: null,
    filterInventoryItemId: null,
    filterSku: null,
    filterName: null,
    filterRetailPrice: null,
    sourceLabel: sourceLabel("no_data")
  };
}

function parseNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function packageDetailsToSuggestion(
  details: TicketPackageDetails,
  source: VehicleServiceDefaultSource,
  confidence: VehicleServiceDefaultConfidence,
  lastServiceDate: string | null,
  lastServiceMileage: number | null
): PreviousOilServiceSuggestion {
  return {
    found: true,
    source,
    confidence,
    lastServiceDate,
    lastServiceMileage,
    packageId: details.package_id ?? null,
    packageName: details.package_name ?? null,
    oilBrand: details.oil_brand ?? null,
    oilType: details.oil_type ?? null,
    viscosity: details.oil_name ?? details.oil_type ?? null,
    includedQuarts: parseNumber(details.included_quarts),
    actualQuarts: parseNumber(details.actual_quarts),
    oilInventoryItemId: details.oil_inventory_item_id ?? null,
    oilSku: details.oil_sku ?? null,
    oilName: details.oil_name ?? null,
    filterInventoryItemId: details.oil_filter_inventory_item_id ?? null,
    filterSku: details.oil_filter_sku ?? null,
    filterName: details.oil_filter_name ?? null,
    filterRetailPrice: null,
    sourceLabel: sourceLabel(source)
  };
}

function parsePackageDetailsFromJson(servicesJson: string | null): TicketPackageDetails | null {
  if (!servicesJson) return null;
  try {
    const parsed = JSON.parse(servicesJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const packageDetails = (parsed as Record<string, unknown>).packageDetails;
    if (!packageDetails || typeof packageDetails !== "object" || Array.isArray(packageDetails)) return null;
    return packageDetails as TicketPackageDetails;
  } catch {
    return null;
  }
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function importedHistoryToSuggestion(servicesJson: string | null, oilType: string | null, serviceDate: string | null, mileage: number | null): PreviousOilServiceSuggestion | null {
  if (!servicesJson) return null;
  try {
    const parsed = JSON.parse(servicesJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const packages = parseStringList(record.packages);
    const inventoryItems = parseStringList(record.inventoryItems);
    const oilLine = inventoryItems.find((item) => /engine oil/i.test(item));
    const filterLine = inventoryItems.find((item) => /oil filter/i.test(item));
    const oilQtyMatch = oilLine?.match(/\(([\d.]+)\s*QT\)/i);
    const actualQuarts = oilQtyMatch ? parseNumber(oilQtyMatch[1]) : null;
    if (!packages.length && !oilType && !actualQuarts && !filterLine) return null;
    return {
      ...noPreviousService(),
      found: true,
      source: "imported_droptop",
      confidence: actualQuarts || oilType ? "medium" : "low",
      lastServiceDate: serviceDate,
      lastServiceMileage: mileage,
      packageName: packages[0] ?? null,
      oilType,
      actualQuarts,
      filterName: filterLine ?? null,
      sourceLabel: sourceLabel("imported_droptop")
    };
  } catch {
    return null;
  }
}

async function getLastPackageDetailsWithTicket(vehicleId: string): Promise<(TicketPackageDetails & { completed_at?: string | null; ticket_mileage?: number | null; is_imported?: number | null }) | null> {
  const rows = await query<TicketPackageDetails & { completed_at?: string | null; ticket_mileage?: number | null; is_imported?: number | null }>(
    `SELECT tpd.*, COALESCE(t.completed_at, t.created_at) AS completed_at, t.vehicle_mileage AS ticket_mileage, t.is_imported
     FROM ticket_package_details tpd
     JOIN tickets t ON t.id = tpd.ticket_id
     WHERE t.vehicle_id = ?
       AND t.deleted_at IS NULL
       AND tpd.deleted_at IS NULL
       AND t.status IN ('completed', 'waiting_payment', 'in_service')
     ORDER BY COALESCE(t.completed_at, t.updated_at, t.created_at) DESC
     LIMIT 1`,
    [vehicleId]
  );
  return rows[0] ?? null;
}

async function getFallbackPackageDetails(vehicle: Vehicle): Promise<(TicketPackageDetails & { completed_at?: string | null; ticket_mileage?: number | null }) | null> {
  const params: unknown[] = [];
  const clauses: string[] = ["t.vehicle_id IS NOT NULL", "t.vehicle_id != ?", "t.deleted_at IS NULL", "tpd.deleted_at IS NULL", "t.status = 'completed'"];
  params.push(vehicle.id);

  if (vehicle.vin?.trim()) {
    clauses.push("UPPER(COALESCE(v.vin, '')) = ?");
    params.push(vehicle.vin.trim().toUpperCase());
  } else if (vehicle.plate?.trim() && vehicle.plate_state?.trim()) {
    clauses.push("UPPER(REPLACE(REPLACE(COALESCE(v.plate, ''), ' ', ''), '-', '')) = UPPER(REPLACE(REPLACE(?, ' ', ''), '-', ''))");
    clauses.push("UPPER(COALESCE(v.plate_state, '')) = ?");
    params.push(vehicle.plate, vehicle.plate_state.trim().toUpperCase());
  } else if (vehicle.year && vehicle.make && vehicle.model) {
    clauses.push("v.year = ? AND LOWER(v.make) = LOWER(?) AND LOWER(v.model) = LOWER(?)");
    params.push(vehicle.year, vehicle.make, vehicle.model);
    if (vehicle.engine_model?.trim()) {
      clauses.push("(v.engine_model IS NULL OR LOWER(v.engine_model) = LOWER(?))");
      params.push(vehicle.engine_model);
    }
  } else {
    return null;
  }

  const rows = await query<TicketPackageDetails & { completed_at?: string | null; ticket_mileage?: number | null }>(
    `SELECT tpd.*, COALESCE(t.completed_at, t.created_at) AS completed_at, t.vehicle_mileage AS ticket_mileage
     FROM ticket_package_details tpd
     JOIN tickets t ON t.id = tpd.ticket_id
     JOIN vehicles v ON v.id = t.vehicle_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC
     LIMIT 1`,
    params
  );
  return rows[0] ?? null;
}

export async function getVehicleServiceDefaults(vehicle: Vehicle | null): Promise<PreviousOilServiceSuggestion> {
  if (!vehicle?.id) return noPreviousService();

  const savedDefaults = await getSavedVehicleServiceDefaults(vehicle.id);
  const hasSavedDefaults = Boolean(savedDefaults?.oil_capacity || savedDefaults?.oil_type || savedDefaults?.oil_filter_sku || savedDefaults?.oil_filter_inventory_item_id);
  if (hasSavedDefaults) {
    return {
      ...noPreviousService(),
      found: true,
      source: "saved_vehicle_default",
      confidence: "high",
      lastServiceDate: savedDefaults?.last_oil_change_date ?? vehicle.last_oil_change_date ?? null,
      lastServiceMileage: savedDefaults?.last_oil_change_mileage ?? vehicle.last_oil_change_mileage ?? vehicle.mileage ?? null,
      oilType: savedDefaults?.oil_type ?? vehicle.oil_type ?? null,
      actualQuarts: savedDefaults?.oil_capacity ?? null,
      filterInventoryItemId: savedDefaults?.oil_filter_inventory_item_id ?? null,
      filterSku: savedDefaults?.oil_filter_sku ?? null,
      sourceLabel: sourceLabel("saved_vehicle_default")
    };
  }

  const history = await getOilChangeHistoryByVehicle(vehicle.id, 8);
  for (const entry of history) {
    const packageDetails = parsePackageDetailsFromJson(entry.services_json);
    if (packageDetails) {
      return packageDetailsToSuggestion(packageDetails, entry.ticket_id?.startsWith("imp") ? "imported_droptop" : "service_history", "high", entry.service_date, entry.mileage);
    }
    const importedSuggestion = importedHistoryToSuggestion(entry.services_json, entry.oil_type, entry.service_date, entry.mileage);
    if (importedSuggestion) return importedSuggestion;
    if (entry.oil_type || entry.mileage) {
      return {
        ...noPreviousService(),
        found: true,
        source: "service_history",
        confidence: "medium",
        lastServiceDate: entry.service_date,
        lastServiceMileage: entry.mileage,
        oilType: entry.oil_type,
        sourceLabel: sourceLabel("service_history")
      };
    }
  }

  const previousTicketDetails = await getLastCompletedTicketPackageDetailsByVehicle(vehicle.id);
  if (previousTicketDetails) {
    return packageDetailsToSuggestion(previousTicketDetails, "previous_ticket", "high", null, vehicle.last_oil_change_mileage ?? null);
  }

  const lastPackage = await getLastPackageDetailsWithTicket(vehicle.id);
  if (lastPackage) {
    return packageDetailsToSuggestion(lastPackage, lastPackage.is_imported ? "imported_droptop" : "previous_ticket", "medium", lastPackage.completed_at ?? null, lastPackage.ticket_mileage ?? null);
  }

  const fallback = await getFallbackPackageDetails(vehicle);
  if (fallback) {
    return packageDetailsToSuggestion(fallback, "fallback_match", vehicle.vin || (vehicle.plate && vehicle.plate_state) ? "medium" : "low", fallback.completed_at ?? null, fallback.ticket_mileage ?? null);
  }

  return noPreviousService();
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
      oilFilter: { source: "none", confidence: "none", message: "No saved filter found." },
      previousService: noPreviousService()
    };
  }

  const vehicle = await getVehicleById(vehicleId);
  const savedDefaults = await getSavedVehicleServiceDefaults(vehicleId);
  const previousService = await getVehicleServiceDefaults(vehicle);
  const oilFilter = await suggestOilFilter(vehicle);
  const previousQuarts = previousService.actualQuarts ?? previousService.includedQuarts ?? null;
  return {
    vehicle,
    oilType: savedDefaults?.oil_type ?? previousService.oilType ?? vehicle?.oil_type ?? null,
    suggestedQuarts: savedDefaults?.oil_capacity ?? previousQuarts ?? packageIncludedQuarts ?? null,
    quartsSource: savedDefaults?.oil_capacity ? "vehicle_default" : previousQuarts ? "last_service" : "package_default",
    lastOilChangeDate: savedDefaults?.last_oil_change_date ?? previousService.lastServiceDate ?? null,
    lastOilChangeMileage: savedDefaults?.last_oil_change_mileage ?? previousService.lastServiceMileage ?? null,
    oilFilter,
    previousService
  };
}
