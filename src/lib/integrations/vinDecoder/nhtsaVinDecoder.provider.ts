import type { NormalizedVehicleDecode, VinDecodeProviderStatus, VinDecodeRequest, VinDecodeResult } from "./vinDecoder.types";

const DEFAULT_BASE_URL = "https://vpic.nhtsa.dot.gov/api";

type NhtsaResponse = { Results?: Array<Record<string, string>> };

function emptyToNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text && text !== "0" && !["not applicable", "n/a", "not available"].includes(text.toLowerCase()) ? text : null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function confidenceFor(row: Record<string, string>): NormalizedVehicleDecode["confidence"] {
  if (row.ModelYear && row.Make && row.Model) return "high";
  if (row.Make || row.Model) return "medium";
  return "low";
}

export function normalizeNhtsaResponse(row: Record<string, string>, vin: string): NormalizedVehicleDecode {
  const gvwrFrom = emptyToNull(row.GVWRFrom);
  const gvwrTo = emptyToNull(row.GVWRTo);
  return {
    vin,
    year: numberOrNull(row.ModelYear),
    make: emptyToNull(row.Make),
    model: emptyToNull(row.Model),
    trim: emptyToNull(row.Trim),
    series: emptyToNull(row.Series),
    bodyClass: emptyToNull(row.BodyClass),
    vehicleType: emptyToNull(row.VehicleType),
    doors: numberOrNull(row.Doors),
    driveType: emptyToNull(row.DriveType),
    fuelType: emptyToNull(row.FuelTypePrimary),
    engineCylinders: numberOrNull(row.EngineCylinders),
    engineDisplacementL: numberOrNull(row.DisplacementL),
    engineDisplacementCc: numberOrNull(row.DisplacementCC),
    engineModel: emptyToNull(row.EngineModel),
    engineConfiguration: emptyToNull(row.EngineConfiguration),
    manufacturer: emptyToNull(row.Manufacturer) ?? emptyToNull(row.ManufacturerName),
    plantCountry: emptyToNull(row.PlantCountry),
    plantState: emptyToNull(row.PlantState),
    transmissionStyle: emptyToNull(row.TransmissionStyle),
    gvwr: [gvwrFrom, gvwrTo].filter(Boolean).join(" - ") || null,
    brakeSystemType: emptyToNull(row.BrakeSystemType),
    raw: row,
    source: "nhtsa_vpic",
    decodedAt: new Date().toISOString(),
    confidence: confidenceFor(row)
  };
}

export async function decodeVin(request: VinDecodeRequest): Promise<VinDecodeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 8000);
  try {
    const baseUrl = (request.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const yearQuery = request.modelYear ? `&modelyear=${encodeURIComponent(String(request.modelYear))}` : "";
    const url = `${baseUrl}/vehicles/DecodeVinValuesExtended/${encodeURIComponent(request.vin)}?format=json${yearQuery}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, status: "error", message: `NHTSA vPIC returned ${response.status}.`, error: { code: "provider_error", message: `NHTSA vPIC returned ${response.status}.` } };
    }
    const raw = await response.json() as NhtsaResponse;
    const row = raw.Results?.[0] ?? {};
    const providerError = emptyToNull(row.ErrorText);
    const errorCode = emptyToNull(row.ErrorCode);
    if (!raw.Results?.length) {
      return { ok: false, status: "error", message: "No vehicle data returned for this VIN.", error: { code: "provider_error", message: "No vehicle data returned for this VIN." } };
    }
    const normalized = normalizeNhtsaResponse(row, request.vin);
    normalized.raw = raw;
    if (!normalized.make && !normalized.model && providerError && errorCode && errorCode !== "0") {
      return { ok: false, status: "error", message: providerError, error: { code: "invalid_vin", message: providerError } };
    }
    return { ok: true, status: "decoded", message: "VIN decoded by NHTSA vPIC.", data: normalized };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      status: "error",
      message: aborted ? "VIN decode timed out. Continue manually." : "VIN decode unavailable. Continue manually.",
      error: { code: aborted ? "timeout" : "network_error", message: error instanceof Error ? error.message : "VIN decode failed." }
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function getProviderStatus(enabled = false): VinDecodeProviderStatus {
  return {
    provider: "nhtsa_vpic",
    configured: true,
    enabled,
    message: enabled ? "NHTSA vPIC VIN decoder is enabled." : "NHTSA vPIC VIN decoder is disabled."
  };
}
