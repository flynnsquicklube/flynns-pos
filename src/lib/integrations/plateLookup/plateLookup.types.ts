export interface PlateLookupRequest {
  plate: string;
  state: string;
  country?: string;
  source?: string;
}

export interface PlateLookupResult {
  status: "found" | "not_found" | "not_configured" | "error";
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
  plate: string;
  state: string;
  source: "local_sqlite" | "external_placeholder";
  confidence: "high" | "medium" | "low" | "none";
  vehicleId?: string | null;
  customerId?: string | null;
  raw?: unknown;
  message?: string;
}

export interface PlateLookupProvider {
  id: string;
  lookupPlate(request: PlateLookupRequest): Promise<PlateLookupResult>;
}
