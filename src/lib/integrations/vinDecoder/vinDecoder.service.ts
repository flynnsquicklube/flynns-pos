import { getSetting, setSetting } from "../../db/repositories/settingsRepo";
import { getCachedDecode, saveCachedDecode } from "../../db/repositories/vinDecodeRepo";
import { searchVehicles } from "../../db/repositories/vehiclesRepo";
import { isValidVin, normalizeVin } from "../../domain/vehicles/vinUtils";
import { decodeVin as decodeWithNhtsa } from "./nhtsaVinDecoder.provider";
import type { NormalizedVehicleDecode, VinDecodeProviderStatus, VinDecodeResult } from "./vinDecoder.types";

export function isLikelyVin(input: string): boolean {
  return isValidVin(input);
}

export function validateVin(vin: string): string | null {
  const normalized = normalizeVin(vin);
  if (normalized.length !== 17) return "VIN must be 17 characters for decoding.";
  if (!/^[A-HJ-NPR-Z0-9]+$/.test(normalized)) return "VIN cannot contain I, O, Q, or symbols.";
  return null;
}

async function settingBoolean(key: string, fallback = false): Promise<boolean> {
  const setting = await getSetting(key);
  if (!setting) return fallback;
  return setting.value === "true" || setting.value === "1";
}

export async function isVinDecodeEnabled(): Promise<boolean> {
  return (await settingBoolean("feature.enableNhtsaVinDecoder", true)) || (await settingBoolean("feature.enableVinDecodeApi", true));
}

export async function setVinDecodeEnabled(enabled: boolean): Promise<void> {
  await Promise.all([
    setSetting("feature.enableVinDecodeApi", enabled ? "true" : "false"),
    setSetting("feature.enableNhtsaVinDecoder", enabled ? "true" : "false")
  ]);
}

export async function getVinDecoderSettings() {
  const [provider, baseUrl, timeoutMs, cacheDays] = await Promise.all([
    getSetting("vin_decoder_provider"),
    getSetting("nhtsa_vpic_base_url"),
    getSetting("vin_decode_timeout_ms"),
    getSetting("vin_decode_cache_days")
  ]);
  return {
    provider: provider?.value ?? "nhtsa_vpic",
    baseUrl: baseUrl?.value ?? "https://vpic.nhtsa.dot.gov/api",
    timeoutMs: Number(timeoutMs?.value) || 8000,
    cacheDays: Number(cacheDays?.value) || 365
  };
}

function vehicleToDecode(vehicle: Awaited<ReturnType<typeof searchVehicles>>[number], vin: string): NormalizedVehicleDecode {
  return {
    vin,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim ?? vehicle.sub_model ?? null,
    series: vehicle.series ?? null,
    bodyClass: vehicle.body_class ?? null,
    vehicleType: vehicle.vehicle_type ?? null,
    doors: vehicle.doors ?? null,
    driveType: vehicle.drive_type ?? null,
    fuelType: vehicle.fuel_type ?? null,
    engineCylinders: vehicle.engine_cylinders ?? null,
    engineDisplacementL: vehicle.engine_displacement_l ?? null,
    engineDisplacementCc: vehicle.engine_displacement_cc ?? null,
    engineModel: vehicle.engine_model ?? null,
    engineConfiguration: vehicle.engine_configuration ?? null,
    manufacturer: vehicle.manufacturer ?? null,
    plantCountry: vehicle.plant_country ?? null,
    plantState: vehicle.plant_state ?? null,
    transmissionStyle: vehicle.transmission_style ?? null,
    gvwr: vehicle.gvwr ?? null,
    brakeSystemType: vehicle.brake_system_type ?? null,
    raw: vehicle,
    source: "local_vehicle",
    decodedAt: vehicle.vin_decoded_at ?? vehicle.updated_at,
    confidence: "high"
  };
}

export async function getCachedVinDecode(vin: string): Promise<NormalizedVehicleDecode | null> {
  return getCachedDecode(normalizeVin(vin));
}

export async function saveVinDecodeCache(result: NormalizedVehicleDecode): Promise<void> {
  await saveCachedDecode(result);
}

export async function decodeVinWithFallback(vinInput: string, options: { modelYear?: string | number | null; forceRefresh?: boolean } = {}): Promise<VinDecodeResult> {
  const vin = normalizeVin(vinInput);
  const validation = validateVin(vin);
  if (validation) return { ok: false, status: "error", message: validation, error: { code: "invalid_vin", message: validation } };
  const settings = await getVinDecoderSettings();

  const localMatch = (await searchVehicles(vin)).find((vehicle) => normalizeVin(vehicle.vin ?? "") === vin);
  if (localMatch && !options.forceRefresh) {
    return { ok: true, status: "local_vehicle", message: "Local vehicle matched by VIN.", data: vehicleToDecode(localMatch, vin) };
  }

  const cached = !options.forceRefresh ? await getCachedDecode(vin) : null;
  if (cached) {
    const decodedAt = Date.parse(cached.decodedAt);
    const cacheMs = settings.cacheDays * 24 * 60 * 60 * 1000;
    if (Number.isFinite(decodedAt) && Date.now() - decodedAt <= cacheMs) {
      return { ok: true, status: "cached", message: "VIN decode loaded from local cache.", data: cached };
    }
  }

  const enabled = await isVinDecodeEnabled();
  if (!enabled) {
    return {
      ok: false,
      status: "disabled",
      message: "VIN decoder is disabled. Continue with manual specs.",
      error: { code: "disabled", message: "VIN decoder is disabled. Continue with manual specs." }
    };
  }

  const decoded = await decodeWithNhtsa({ vin, modelYear: options.modelYear, timeoutMs: settings.timeoutMs, baseUrl: settings.baseUrl });
  if (decoded.ok && decoded.data) await saveCachedDecode(decoded.data);
  return decoded;
}

export const decodeVin = decodeVinWithFallback;
export const decodeVinWithCache = decodeVinWithFallback;

export async function getVinDecodeStatus(): Promise<VinDecodeProviderStatus> {
  return {
    provider: "nhtsa_vpic",
    configured: true,
    enabled: await isVinDecodeEnabled(),
    message: "Free public NHTSA vPIC VIN decoder. Manual entry remains available offline."
  };
}

export function applyDecodedVehicleToDraft<T extends {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  drive_type?: string;
  fuel_type?: string;
  transmission_style?: string;
  vin?: string;
  notes?: string;
}>(
  decoded: NormalizedVehicleDecode,
  existingDraft: T
): T {
  return {
    ...existingDraft,
    vin: existingDraft.vin || decoded.vin,
    year: existingDraft.year || (decoded.year ? String(decoded.year) : ""),
    make: existingDraft.make || decoded.make || "",
    model: existingDraft.model || decoded.model || "",
    trim: existingDraft.trim || decoded.trim || decoded.series || "",
    engine: existingDraft.engine || decoded.engineModel || decoded.engineDisplacementL?.toString() || "",
    drive_type: existingDraft.drive_type || decoded.driveType || "",
    fuel_type: existingDraft.fuel_type || decoded.fuelType || "",
    transmission_style: existingDraft.transmission_style || decoded.transmissionStyle || "",
    notes: [
      existingDraft.notes,
      decoded.trim ? `Trim: ${decoded.trim}` : "",
      decoded.bodyClass ? `Body: ${decoded.bodyClass}` : "",
      decoded.fuelType ? `Fuel: ${decoded.fuelType}` : "",
      decoded.driveType ? `Drive: ${decoded.driveType}` : ""
    ].filter(Boolean).join(" | ")
  };
}
