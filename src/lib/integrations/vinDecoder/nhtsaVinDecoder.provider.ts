import { defaultFeatureFlags } from "../../config/featureFlags";
import type { NormalizedDecodedVehicle, VinDecodeRequest, VinDecoderProvider } from "./vinDecoder.types";

const DEFAULT_ENDPOINT = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

type NhtsaResponse = { Results?: Array<Record<string, string>> };

export class NhtsaVinDecoderProvider implements VinDecoderProvider {
  constructor(private endpoint = DEFAULT_ENDPOINT, private enabled = defaultFeatureFlags.enableVinDecodeApi) {}

  async decodeVin({ vin, modelYear }: VinDecodeRequest): Promise<NormalizedDecodedVehicle> {
    if (!this.enabled) throw new Error("VIN decoder is disabled. Local lookup and manual entry are available.");
    const yearQuery = modelYear ? `&modelyear=${encodeURIComponent(String(modelYear))}` : "";
    const response = await fetch(`${this.endpoint}/${encodeURIComponent(vin)}?format=json${yearQuery}`);
    if (!response.ok) throw new Error(`NHTSA VIN decode failed: ${response.status}`);
    const data = await response.json() as NhtsaResponse;
    return normalizeDecodedVehicle(data.Results?.[0] ?? {});
  }
}

export function normalizeDecodedVehicle(row: Record<string, string>): NormalizedDecodedVehicle {
  return {
    year: row.ModelYear || null,
    make: row.Make || null,
    model: row.Model || null,
    trim: row.Trim || row.Series || null,
    engine: row.EngineModel || row.DisplacementL || null,
    bodyClass: row.BodyClass || null,
    fuelType: row.FuelTypePrimary || null,
    driveType: row.DriveType || null,
    manufacturer: row.Manufacturer || null,
    raw: row
  };
}

