import { findOilFilterBySkuOrProductId, getInventoryItem, searchOilFiltersForVehicle } from "../../db/repositories/inventoryRepo";
import { getLastOilFilterForVehicle } from "../../db/repositories/serviceHistoryRepo";
import { getLastCompletedTicketItemsByVehicle, getLastCompletedTicketPackageDetailsByVehicle } from "../../db/repositories/ticketsRepo";
import type { InventoryItem } from "../../../types/inventory";
import type { Vehicle } from "../../../types/vehicle";

export type OilFilterSuggestionSource = "vehicle_default" | "last_service" | "inventory_match" | "manual" | "none";
export type OilFilterSuggestionConfidence = "high" | "medium" | "low" | "none";

export interface OilFilterSuggestion {
  inventoryItemId?: string;
  sku?: string;
  productId?: string;
  name?: string;
  brand?: string;
  retailPrice?: number;
  cost?: number;
  quantityOnHand?: number;
  source: OilFilterSuggestionSource;
  confidence: OilFilterSuggestionConfidence;
  message: string;
}

function fromInventory(item: InventoryItem, source: OilFilterSuggestionSource, confidence: OilFilterSuggestionConfidence, message: string): OilFilterSuggestion {
  return {
    inventoryItemId: item.id,
    sku: item.sku ?? undefined,
    productId: item.product_id ?? undefined,
    name: item.name,
    brand: item.vendor ?? undefined,
    retailPrice: item.retail_price,
    cost: item.cost,
    quantityOnHand: item.quantity_on_hand,
    source,
    confidence,
    message
  };
}

function extractFilterSku(text: string | null | undefined): string | null {
  if (!text) return null;
  const ofMatch = text.match(/\bOF[\s-]?[A-Z0-9]{2,8}\b/i);
  if (ofMatch) return ofMatch[0].replace(/\s+/g, "").toUpperCase();
  const serviceChampMatch = text.match(/\b[A-Z]{1,4}\d{2,6}[A-Z]?\b/i);
  return serviceChampMatch?.[0]?.toUpperCase() ?? null;
}

export async function suggestOilFilter(vehicle: Vehicle | null): Promise<OilFilterSuggestion> {
  if (!vehicle?.id) {
    return { source: "none", confidence: "none", message: "No saved filter found." };
  }

  if (vehicle.oil_filter_inventory_item_id) {
    const item = await getInventoryItem(vehicle.oil_filter_inventory_item_id);
    if (item) return fromInventory(item, "vehicle_default", "high", "Suggested from vehicle default.");
  }

  if (vehicle.oil_filter_sku) {
    const item = await findOilFilterBySkuOrProductId(vehicle.oil_filter_sku);
    if (item) return fromInventory(item, "inventory_match", "high", "Matched saved filter SKU to inventory.");
    return {
      sku: vehicle.oil_filter_sku,
      source: "vehicle_default",
      confidence: "medium",
      message: "Saved filter SKU found, but no matching inventory item is available."
    };
  }

  const lastPackageDetails = await getLastCompletedTicketPackageDetailsByVehicle(vehicle.id);
  if (lastPackageDetails?.oil_filter_inventory_item_id) {
    const item = await getInventoryItem(lastPackageDetails.oil_filter_inventory_item_id);
    if (item) return fromInventory(item, "last_service", "high", "Suggested from last completed ticket package.");
  }
  if (lastPackageDetails?.oil_filter_sku) {
    const item = await findOilFilterBySkuOrProductId(lastPackageDetails.oil_filter_sku);
    if (item) return fromInventory(item, "last_service", "high", "Matched last completed package filter to inventory.");
    return {
      sku: lastPackageDetails.oil_filter_sku,
      name: lastPackageDetails.oil_filter_name ?? undefined,
      source: "last_service",
      confidence: "medium",
      message: "Last completed package had a saved filter SKU, but inventory could not be matched."
    };
  }
  if (lastPackageDetails?.oil_filter_name) {
    const extractedSku = extractFilterSku(lastPackageDetails.oil_filter_name);
    if (extractedSku) {
      const item = await findOilFilterBySkuOrProductId(extractedSku);
      if (item) return fromInventory(item, "last_service", "medium", "Matched last package filter name to inventory.");
    }
  }

  const lastFilter = await getLastOilFilterForVehicle(vehicle.id);
  if (lastFilter?.inventoryItemId) {
    const item = await getInventoryItem(lastFilter.inventoryItemId);
    if (item) return fromInventory(item, "last_service", "high", "Suggested from last completed service.");
  }
  if (lastFilter?.sku) {
    const item = await findOilFilterBySkuOrProductId(lastFilter.sku);
    if (item) return fromInventory(item, "last_service", "medium", "Matched last service filter to inventory.");
  }
  if (lastFilter?.name) {
    return { name: lastFilter.name, sku: lastFilter.sku ?? undefined, source: "last_service", confidence: "low", message: "Last service mentioned an oil filter, but inventory could not be matched." };
  }

  const lastItems = await getLastCompletedTicketItemsByVehicle(vehicle.id);
  for (const item of lastItems) {
    const text = `${item.name ?? ""} ${item.sku ?? ""} ${item.product_id ?? ""}`.trim();
    const looksLikeFilter = /oil filter|engine oil filter|service champ|\bOF[\s-]?[A-Z0-9]{2,8}\b/i.test(text);
    if (!looksLikeFilter) continue;
    if (item.inventory_item_id) {
      const inventoryItem = await getInventoryItem(item.inventory_item_id);
      if (inventoryItem) return fromInventory(inventoryItem, "last_service", "high", "Suggested from last completed ticket item.");
    }
    const extractedSku = item.sku ?? item.product_id ?? extractFilterSku(text);
    if (extractedSku) {
      const inventoryItem = await findOilFilterBySkuOrProductId(extractedSku);
      if (inventoryItem) return fromInventory(inventoryItem, "last_service", "medium", "Matched last ticket filter item to inventory.");
      return { sku: extractedSku, name: item.name, source: "last_service", confidence: "low", message: "Last ticket included a filter SKU, but inventory could not be matched." };
    }
    return { name: item.name, source: "last_service", confidence: "low", message: "Last ticket included an oil filter, but no inventory item was matched." };
  }

  const fallbackItems = await searchOilFiltersForVehicle(vehicle);
  if (fallbackItems[0]) return fromInventory(fallbackItems[0], "inventory_match", "low", "Possible filter match from inventory text.");

  return { source: "none", confidence: "none", message: "No saved filter found." };
}
