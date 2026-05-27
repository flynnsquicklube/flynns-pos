import { getVehicleCatalogCache, saveVehicleCatalogCache, saveVehicleCatalogOptions } from "./vehicleCatalogCacheRepo";
import { epaVehicleCatalogProvider } from "./epaVehicleCatalog.provider";
import { nhtsaVehicleCatalogProvider } from "./nhtsaVehicleCatalog.provider";
import type { VehicleCatalogMake, VehicleCatalogModel, VehicleCatalogOption, VehicleCatalogSearchInput, VehicleCatalogYear } from "./vehicleCatalog.types";

const cacheDays = 30;

function expiresAt() {
  return new Date(Date.now() + cacheDays * 24 * 60 * 60 * 1000).toISOString();
}

function recentYears(): VehicleCatalogYear[] {
  const current = new Date().getFullYear() + 1;
  const years: VehicleCatalogYear[] = [];
  for (let year = current; year >= 1981; year -= 1) years.push({ year });
  return years;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item).trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function cached<T>(provider: string, cacheType: string, cacheKey: string, loader: () => Promise<T>): Promise<T> {
  try {
    const found = await getVehicleCatalogCache<T>(cacheKey);
    if (found) return found;
  } catch {
    // Cache unavailable should never block the workflow.
  }
  const response = await loader();
  try {
    await saveVehicleCatalogCache({ provider, cacheType, cacheKey, response, expiresAt: expiresAt() });
  } catch {
    // Ignore cache writes in browser-only/dev contexts.
  }
  return response;
}

export async function listYears(): Promise<VehicleCatalogYear[]> {
  return cached("local", "years", "vehicle-catalog:years", async () => {
    try {
      const years = await epaVehicleCatalogProvider.listYears();
      return years.length ? years : recentYears();
    } catch {
      return recentYears();
    }
  });
}

export async function listMakesForYear(year: number): Promise<VehicleCatalogMake[]> {
  return cached("epa+nhtsa", "makes", `vehicle-catalog:makes:${year}`, async () => {
    const responses = await Promise.allSettled([
      epaVehicleCatalogProvider.listMakesForYear(year),
      nhtsaVehicleCatalogProvider.listMakesForYear(year)
    ]);
    const rows = responses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return uniqueBy(rows, (item) => item.makeName).sort((a, b) => a.makeName.localeCompare(b.makeName));
  });
}

export async function listModelsForYearMake(year: number, make: string): Promise<VehicleCatalogModel[]> {
  return cached("epa+nhtsa", "models", `vehicle-catalog:models:${year}:${make.toUpperCase()}`, async () => {
    const responses = await Promise.allSettled([
      epaVehicleCatalogProvider.listModelsForYearMake(year, make),
      nhtsaVehicleCatalogProvider.listModelsForYearMake(year, make)
    ]);
    const rows = responses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return uniqueBy(rows, (item) => item.modelName).sort((a, b) => a.modelName.localeCompare(b.modelName));
  });
}

export async function listOptionsForYearMakeModel(year: number, make: string, model: string): Promise<VehicleCatalogOption[]> {
  return cached("epa+nhtsa", "options", `vehicle-catalog:options:${year}:${make.toUpperCase()}:${model.toUpperCase()}`, async () => {
    const responses = await Promise.allSettled([
      epaVehicleCatalogProvider.listOptionsForYearMakeModel(year, make, model),
      nhtsaVehicleCatalogProvider.listOptionsForYearMakeModel(year, make, model)
    ]);
    const rows = responses.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const unique = uniqueBy(rows, (item) => item.id || `${item.trim ?? ""}:${item.engine ?? ""}:${item.transmission ?? ""}`);
    try {
      await saveVehicleCatalogOptions(unique);
    } catch {
      // Cache persistence is best-effort.
    }
    return unique;
  });
}

export async function getOptionDetails(optionId: string): Promise<VehicleCatalogOption | null> {
  return cached("epa", "option_details", `vehicle-catalog:option:${optionId}`, async () => {
    const detail = await epaVehicleCatalogProvider.getOptionDetails(optionId);
    if (detail) {
      try {
        await saveVehicleCatalogOptions([detail]);
      } catch {
        // Best effort.
      }
    }
    return detail;
  });
}

export async function searchVehicleOptions(input: VehicleCatalogSearchInput): Promise<VehicleCatalogOption[]> {
  const year = Number(input.year);
  if (!Number.isFinite(year) || !input.make || !input.model) return [];
  const options = await listOptionsForYearMakeModel(year, input.make, input.model);
  const trim = input.trim?.trim().toUpperCase();
  const engine = input.engine?.trim().toUpperCase();
  return options.filter((option) => {
    const trimMatch = !trim || option.trim?.toUpperCase().includes(trim);
    const engineMatch = !engine || option.engine?.toUpperCase().includes(engine);
    return trimMatch && engineMatch;
  });
}
