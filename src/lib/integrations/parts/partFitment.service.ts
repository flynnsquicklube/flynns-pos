import type { PartFitmentRequest, PartFitmentResult } from "./partFitment.types";
import { getLocalHistoryFitment } from "./localHistoryFitment.provider";

export async function getPartFitment(request: PartFitmentRequest & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getLocalHistoryFitment(request);
}

export async function getOilFilters(request: Omit<PartFitmentRequest, "category"> & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getPartFitment({ ...request, category: "oil_filter" });
}

export async function getAirFilters(request: Omit<PartFitmentRequest, "category"> & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getPartFitment({ ...request, category: "air_filter" });
}

export async function getCabinFilters(request: Omit<PartFitmentRequest, "category"> & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getPartFitment({ ...request, category: "cabin_filter" });
}

export async function getWipers(request: Omit<PartFitmentRequest, "category"> & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getPartFitment({ ...request, category: "wiper" });
}

export async function getOilCapacity(request: Omit<PartFitmentRequest, "category"> & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getPartFitment({ ...request, category: "oil_capacity" });
}

export async function getWheelTorque(request: Omit<PartFitmentRequest, "category"> & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  return getPartFitment({ ...request, category: "wheel_torque" });
}
