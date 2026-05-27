export interface FuelEconomyVehicleCandidate {
  epaVehicleId: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  fuelType: string | null;
  cylinders: number | null;
  displacement: number | null;
  transmission: string | null;
  drive: string | null;
  vehicleClass: string | null;
  mpgCity: number | null;
  mpgHighway: number | null;
  mpgCombined: number | null;
  raw: unknown;
}

export interface FuelEconomyResult<T> {
  ok: boolean;
  status: "disabled" | "cached" | "fetched" | "error";
  message: string;
  data?: T;
}
