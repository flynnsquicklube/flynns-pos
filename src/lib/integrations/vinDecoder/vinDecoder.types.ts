export type VinDecodeProvider = "nhtsa_vpic";
export type VinDecodeConfidence = "high" | "medium" | "low" | "none";

export interface VinDecodeRequest {
  vin: string;
  modelYear?: string | number | null;
  timeoutMs?: number;
  baseUrl?: string;
}

export interface NormalizedVehicleDecode {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  series: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  doors: number | null;
  driveType: string | null;
  fuelType: string | null;
  engineCylinders: number | null;
  engineDisplacementL: number | null;
  engineDisplacementCc: number | null;
  engineModel: string | null;
  engineConfiguration: string | null;
  manufacturer: string | null;
  plantCountry: string | null;
  plantState: string | null;
  transmissionStyle: string | null;
  gvwr: string | null;
  brakeSystemType: string | null;
  raw: unknown;
  source: VinDecodeProvider | "local_cache" | "local_vehicle";
  decodedAt: string;
  confidence: VinDecodeConfidence;
}

export interface VinDecodeError {
  code: "disabled" | "invalid_vin" | "network_error" | "timeout" | "provider_error" | "not_configured";
  message: string;
}

export interface VinDecodeResult {
  ok: boolean;
  status: "decoded" | "cached" | "local_vehicle" | "disabled" | "error";
  message: string;
  data?: NormalizedVehicleDecode;
  error?: VinDecodeError;
}

export interface VinDecodeProviderStatus {
  provider: VinDecodeProvider;
  configured: boolean;
  enabled: boolean;
  message: string;
}
