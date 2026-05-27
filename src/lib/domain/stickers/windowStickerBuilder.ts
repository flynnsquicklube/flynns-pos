import type { OilFilterSuggestion } from "../services/oilFilterSuggestion";
import type { Customer } from "../../../types/customer";
import type { ServicePackage } from "../../../types/servicePackage";
import type { Vehicle } from "../../../types/vehicle";
import { defaultBusinessProfile } from "../../config/businessProfile";

export interface WindowStickerPrintData {
  businessName: string;
  ticketId: string;
  date: string;
  customerName: string;
  vehicleLabel: string;
  vinLast8: string | null;
  plate: string | null;
  currentMileage: number;
  nextServiceMileage: number;
  nextServiceDate: string;
  oilType: string | null;
  actualQuarts: number;
  oilFilterSku: string | null;
  oilFilterName: string | null;
  technician: string;
  disclaimer: string | null;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function buildWindowStickerData(input: {
  ticketId: string;
  customer: Customer;
  vehicle: Vehicle;
  servicePackage: ServicePackage | null;
  actualQuarts: number;
  oilTypeOverride?: string | null;
  oilFilter?: OilFilterSuggestion | null;
  nextServiceMiles?: number;
  nextServiceMonths?: number;
  disclaimer?: string | null;
  businessName?: string;
}): WindowStickerPrintData {
  const now = new Date();
  const nextMiles = input.nextServiceMiles ?? 3000;
  const nextMonths = input.nextServiceMonths ?? 3;
  const currentMileage = Number(input.vehicle.mileage) || 0;
  return {
    businessName: input.businessName ?? defaultBusinessProfile.business_name,
    ticketId: input.ticketId,
    date: now.toISOString(),
    customerName: `${input.customer.first_name} ${input.customer.last_name}`.trim(),
    vehicleLabel: [input.vehicle.year, input.vehicle.make, input.vehicle.model].filter(Boolean).join(" "),
    vinLast8: input.vehicle.vin ? input.vehicle.vin.slice(-8) : null,
    plate: [input.vehicle.plate, input.vehicle.plate_state].filter(Boolean).join(" ") || null,
    currentMileage,
    nextServiceMileage: currentMileage + nextMiles,
    nextServiceDate: addMonths(now, nextMonths).toISOString(),
    oilType: input.oilTypeOverride ?? input.servicePackage?.oil_type ?? input.vehicle.oil_type ?? null,
    actualQuarts: input.actualQuarts,
    oilFilterSku: input.oilFilter?.sku ?? input.oilFilter?.productId ?? null,
    oilFilterName: input.oilFilter?.name ?? null,
    technician: "Technician",
    disclaimer: input.disclaimer ?? null
  };
}
