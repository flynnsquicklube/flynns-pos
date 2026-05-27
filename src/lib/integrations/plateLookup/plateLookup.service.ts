import { getSetting } from "../../db/repositories/settingsRepo";
import { normalizePlate, normalizePlateState } from "../../domain/vehicles/plateUtils";
import { localPlateLookupProvider } from "./localPlateLookup.provider";
import { externalPlateLookupPlaceholderProvider } from "./providerPlaceholder";
import type { PlateLookupRequest, PlateLookupResult } from "./plateLookup.types";

async function settingEnabled(key: string, fallback: boolean): Promise<boolean> {
  const setting = await getSetting(key);
  if (!setting) return fallback;
  return setting.value === "true" || setting.value === "1";
}

export async function isLocalPlateLookupEnabled(): Promise<boolean> {
  return settingEnabled("feature.enableLocalPlateLookup", true);
}

export async function isExternalPlateLookupEnabled(): Promise<boolean> {
  return settingEnabled("feature.enableExternalPlateLookup", false);
}

export async function lookupPlateLocalFirst(request: PlateLookupRequest): Promise<PlateLookupResult> {
  const normalizedRequest = {
    ...request,
    plate: normalizePlate(request.plate),
    state: normalizePlateState(request.state),
    country: request.country ?? "US"
  };

  if (await isLocalPlateLookupEnabled()) {
    const localResult = await localPlateLookupProvider.lookupPlate(normalizedRequest);
    if (localResult.status === "found") return localResult;
  }

  if (await isExternalPlateLookupEnabled()) {
    return externalPlateLookupPlaceholderProvider.lookupPlate(normalizedRequest);
  }

  return {
    status: "not_found",
    plate: normalizedRequest.plate,
    state: normalizedRequest.state,
    source: "local_sqlite",
    confidence: "none",
    message: `No local vehicle found for ${normalizedRequest.plate} ${normalizedRequest.state}.`
  };
}
