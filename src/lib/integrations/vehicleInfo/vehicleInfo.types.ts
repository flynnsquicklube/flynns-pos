import type { Vehicle } from "../../../types/vehicle";

export type VehicleInfoProvider = "local_history" | "manual_web_search" | "google_programmable_search" | "nhtsa_vpic";
export type VehicleInfoConfidence = "high" | "medium" | "low" | "verify";

export interface VehicleInfoLookupContext {
  vehicleId?: string | null;
  vin?: string | null;
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  vehicle?: Partial<Vehicle> | null;
}

export interface VehicleInfoSuggestion {
  oilCapacityQuarts?: number | null;
  oilType?: string | null;
  oilFilterSku?: string | null;
  airFilterSku?: string | null;
  cabinFilterSku?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  confidence: VehicleInfoConfidence;
  note?: string | null;
}

export interface VehicleInfoLookupResult extends VehicleInfoSuggestion {
  id: string;
  provider: VehicleInfoProvider;
  sourceTitle: string;
  sourceUrl: string;
  snippet: string;
  query: string;
  suggestedOilCapacity?: number | null;
  suggestedOilType?: string | null;
  suggestedOilFilter?: string | null;
  suggestedAirFilter?: string | null;
  suggestedCabinFilter?: string | null;
  raw?: unknown;
  fetchedAt: string;
}

export interface ManualSearchLink {
  id: string;
  label: string;
  query: string;
  url: string;
}

export interface VehicleInfoDefaults {
  oil_type: string | null;
  oil_capacity: number | null;
  oil_filter_sku: string | null;
  oil_filter_inventory_item_id?: string | null;
  air_filter_sku: string | null;
  cabin_filter_sku: string | null;
  vehicle_info_notes: string | null;
  vehicle_info_source_url: string | null;
  vehicle_info_source_title: string | null;
  vehicle_info_verified_at?: string | null;
}

export interface VehicleInfoProviderStatus {
  provider: VehicleInfoProvider;
  status: "enabled" | "disabled" | "not_configured" | "error";
  message: string;
}
