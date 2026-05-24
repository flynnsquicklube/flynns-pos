import { defaultFeatureFlags, type FeatureFlags } from "../../config/featureFlags";
import { disabled, type IntegrationResult } from "../integrationTypes";
import { NhtsaVinDecoderProvider } from "./nhtsaVinDecoder.provider";
import type { NormalizedDecodedVehicle } from "./vinDecoder.types";

export async function decodeVin(vin: string, modelYear?: string | number, flags: FeatureFlags = defaultFeatureFlags): Promise<IntegrationResult<NormalizedDecodedVehicle>> {
  if (!flags.enableVinDecodeApi) return disabled("VIN decoding API is disabled. Use local lookup or manual entry.");
  try {
    const provider = new NhtsaVinDecoderProvider(undefined, true);
    return { ok: true, status: "ready", message: "VIN decoded.", data: await provider.decodeVin({ vin, modelYear }) };
  } catch (error) {
    return { ok: false, status: "error", message: error instanceof Error ? error.message : "VIN decode failed." };
  }
}

