export interface VehicleCatalogYear {
  year: number;
}

export interface VehicleCatalogMake {
  makeId?: string | number | null;
  makeName: string;
}

export interface VehicleCatalogModel {
  modelId?: string | number | null;
  modelName: string;
}

export interface VehicleCatalogOption {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  displacement: string | null;
  cylinders: string | null;
  transmission: string | null;
  drive: string | null;
  fuelType: string | null;
  bodyClass: string | null;
  source: "epa_fueleconomy" | "nhtsa_vpic" | "manual" | "cache";
  raw: unknown;
}

export interface VehicleCatalogSearchInput {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
}

export interface VehicleCatalogProvider {
  listYears(): Promise<VehicleCatalogYear[]>;
  listMakesForYear(year: number): Promise<VehicleCatalogMake[]>;
  listModelsForYearMake(year: number, make: string): Promise<VehicleCatalogModel[]>;
  listOptionsForYearMakeModel(year: number, make: string, model: string): Promise<VehicleCatalogOption[]>;
  getOptionDetails(optionId: string): Promise<VehicleCatalogOption | null>;
}
