import { getSetting, setSetting } from "../../db/repositories/settingsRepo";
import { getFuelEconomyCache, saveFuelEconomyCache } from "../../db/repositories/fuelEconomyCacheRepo";
import * as epa from "./epaFuelEconomy.provider";
import type { FuelEconomyResult, FuelEconomyVehicleCandidate } from "./fuelEconomy.types";

async function enabled(): Promise<boolean> {
  const setting = await getSetting("feature.enableEpaFuelEconomy");
  return setting?.value === "true" || setting?.value === "1";
}

export async function isFuelEconomyEnabled(): Promise<boolean> {
  return enabled();
}

export async function setFuelEconomyEnabled(value: boolean): Promise<void> {
  await setSetting("feature.enableEpaFuelEconomy", value ? "true" : "false");
}

function cacheKey(parts: unknown[]): string {
  return parts.map((part) => String(part ?? "").trim().toLowerCase()).join(":");
}

async function cachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<FuelEconomyResult<T>> {
  const cached = await getFuelEconomyCache<T>(key);
  if (cached) return { ok: true, status: "cached", message: "Loaded from local EPA cache.", data: cached };
  const data = await fetcher();
  await saveFuelEconomyCache(key, data);
  return { ok: true, status: "fetched", message: "Fetched from EPA FuelEconomy.gov.", data };
}

export async function listEpaMakes(year: number): Promise<FuelEconomyResult<string[]>> {
  if (!(await enabled())) return { ok: false, status: "disabled", message: "EPA FuelEconomy.gov is disabled." };
  return cachedOrFetch(cacheKey(["makes", year]), () => epa.listMakes(year));
}

export async function listEpaModels(year: number, make: string): Promise<FuelEconomyResult<string[]>> {
  if (!(await enabled())) return { ok: false, status: "disabled", message: "EPA FuelEconomy.gov is disabled." };
  return cachedOrFetch(cacheKey(["models", year, make]), () => epa.listModels(year, make));
}

export async function searchEpaVehicleCandidates(year: number, make: string, model: string): Promise<FuelEconomyResult<FuelEconomyVehicleCandidate[]>> {
  if (!(await enabled())) return { ok: false, status: "disabled", message: "EPA FuelEconomy.gov is disabled." };
  if (!year || !make.trim() || !model.trim()) return { ok: false, status: "error", message: "Year, make, and model are required for EPA matching." };
  try {
    return await cachedOrFetch(cacheKey(["candidates", year, make, model]), () => epa.searchVehicleCandidates(year, make, model));
  } catch (error) {
    return { ok: false, status: "error", message: error instanceof Error ? error.message : "EPA lookup failed." };
  }
}
