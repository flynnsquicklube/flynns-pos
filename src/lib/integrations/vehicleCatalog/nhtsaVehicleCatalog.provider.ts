import type { VehicleCatalogMake, VehicleCatalogModel, VehicleCatalogOption, VehicleCatalogProvider, VehicleCatalogYear } from "./vehicleCatalog.types";

const NHTSA_BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles";

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`NHTSA request failed: ${response.status}`);
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

interface NhtsaResponse<T> {
  Results?: T[];
}

interface NhtsaMake {
  Make_ID?: number;
  MakeId?: number;
  Make_Name?: string;
  MakeName?: string;
}

interface NhtsaModel {
  Model_ID?: number;
  Model_Name?: string;
  ModelName?: string;
}

function recentYears(): VehicleCatalogYear[] {
  const current = new Date().getFullYear() + 1;
  const years: VehicleCatalogYear[] = [];
  for (let year = current; year >= 1981; year -= 1) years.push({ year });
  return years;
}

export const nhtsaVehicleCatalogProvider: VehicleCatalogProvider = {
  async listYears() {
    return recentYears();
  },

  async listMakesForYear(year: number): Promise<VehicleCatalogMake[]> {
    void year;
    const data = await fetchJson<NhtsaResponse<NhtsaMake>>(`${NHTSA_BASE_URL}/GetMakesForVehicleType/car?format=json`);
    return (data.Results ?? [])
      .map((item) => ({ makeId: item.Make_ID ?? item.MakeId ?? null, makeName: item.Make_Name ?? item.MakeName ?? "" }))
      .filter((item) => item.makeName)
      .sort((a, b) => a.makeName.localeCompare(b.makeName));
  },

  async listModelsForYearMake(year: number, make: string): Promise<VehicleCatalogModel[]> {
    const data = await fetchJson<NhtsaResponse<NhtsaModel>>(`${NHTSA_BASE_URL}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`);
    return (data.Results ?? [])
      .map((item) => ({ modelId: item.Model_ID ?? null, modelName: item.Model_Name ?? item.ModelName ?? "" }))
      .filter((item) => item.modelName)
      .sort((a, b) => a.modelName.localeCompare(b.modelName));
  },

  async listOptionsForYearMakeModel(year: number, make: string, model: string): Promise<VehicleCatalogOption[]> {
    return [{
      id: `nhtsa:${year}:${make}:${model}`,
      year,
      make,
      model,
      trim: null,
      engine: null,
      displacement: null,
      cylinders: null,
      transmission: null,
      drive: null,
      fuelType: null,
      bodyClass: null,
      source: "nhtsa_vpic",
      raw: { year, make, model }
    }];
  },

  async getOptionDetails() {
    return null;
  }
};
