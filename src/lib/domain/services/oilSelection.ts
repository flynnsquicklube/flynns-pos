import { searchEngineOil } from "../../db/repositories/inventoryRepo";
import type { InventoryItem } from "../../../types/inventory";
import type { ServicePackage } from "../../../types/servicePackage";
import type { Vehicle } from "../../../types/vehicle";

export interface OilSelectionSuggestion {
  inventoryItemId?: string;
  sku?: string;
  name?: string;
  brand?: string;
  viscosity?: string | null;
  formulation?: string | null;
  quantityOnHand?: number;
  retailPrice?: number;
  source: "vehicle_default" | "last_service" | "package_default" | "manual" | "none";
  message: string;
}

function fromInventory(item: InventoryItem, source: OilSelectionSuggestion["source"], message: string): OilSelectionSuggestion {
  return {
    inventoryItemId: item.id,
    sku: item.sku ?? item.product_id ?? undefined,
    name: item.name,
    brand: item.vendor ?? undefined,
    viscosity: item.viscosity ?? null,
    formulation: item.oil_formulation ?? null,
    quantityOnHand: item.quantity_on_hand,
    retailPrice: item.retail_price,
    source,
    message
  };
}

export function inventoryItemToOilSelectionSuggestion(item: InventoryItem): OilSelectionSuggestion {
  return fromInventory(item, "manual", "Manually selected from local inventory.");
}

export async function suggestEngineOil(vehicle: Vehicle | null, servicePackage: ServicePackage): Promise<OilSelectionSuggestion> {
  const oilType = vehicle?.oil_type ?? servicePackage.oil_type ?? "";
  const candidates = await searchEngineOil(oilType, oilType, 10);
  if (candidates[0]) {
    return fromInventory(candidates[0], vehicle?.oil_type ? "vehicle_default" : "package_default", vehicle?.oil_type ? "Suggested from vehicle oil type." : "Suggested from selected package.");
  }
  return {
    sku: undefined,
    name: servicePackage.oil_type ?? "Engine Oil",
    brand: servicePackage.oil_brand ?? undefined,
    source: "package_default",
    message: "No matching oil inventory item found; using package oil type."
  };
}
