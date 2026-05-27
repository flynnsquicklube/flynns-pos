import { getInventoryItemById, searchInventoryAdvanced } from "../../db/repositories/inventoryRepo";
import { getLastOilFilterForVehicle, getOilChangeHistoryByVehicle } from "../../db/repositories/serviceHistoryRepo";
import { getVehicleById } from "../../db/repositories/vehiclesRepo";
import { query } from "../../db/sqlite";
import type { PartCategory, PartFitmentRequest, PartFitmentResult, SuggestedPart, SuggestedServiceSpec } from "./partFitment.types";

function confidenceFromSource(source: string): SuggestedPart["confidence"] {
  if (source.includes("vehicle_default")) return "high";
  if (source.includes("service_history")) return "medium";
  return "low";
}

async function oilFilterSuggestions(vehicleId?: string | null): Promise<SuggestedPart[]> {
  if (!vehicleId) return [];
  const vehicle = await getVehicleById(vehicleId).catch(() => null);
  const suggestions: SuggestedPart[] = [];
  if (vehicle?.oil_filter_inventory_item_id) {
    const item = await getInventoryItemById(vehicle.oil_filter_inventory_item_id);
    if (item) {
      suggestions.push({
        category: "oil_filter",
        productId: item.product_id,
        sku: item.sku,
        brand: item.brand ?? item.vendor,
        name: item.product_type ?? item.name,
        confidence: "high",
        source: "vehicle_default_inventory",
        raw: item
      });
    }
  }
  if (vehicle?.oil_filter_sku && !suggestions.some((item) => item.sku === vehicle.oil_filter_sku || item.productId === vehicle.oil_filter_sku)) {
    suggestions.push({ category: "oil_filter", sku: vehicle.oil_filter_sku, name: `Oil Filter ${vehicle.oil_filter_sku}`, confidence: "high", source: "vehicle_default_sku" });
  }
  const lastFilter = await getLastOilFilterForVehicle(vehicleId);
  if (lastFilter?.sku || lastFilter?.name) {
    suggestions.push({
      category: "oil_filter",
      productId: lastFilter.sku,
      sku: lastFilter.sku,
      name: lastFilter.name ?? `Oil Filter ${lastFilter.sku ?? ""}`.trim(),
      confidence: confidenceFromSource("service_history"),
      source: "service_history",
      raw: lastFilter
    });
  }
  return suggestions;
}

async function priorItemSuggestions(vehicleId: string | null | undefined, category: PartCategory): Promise<SuggestedPart[]> {
  if (!vehicleId) return [];
  const words: Record<string, string> = {
    air_filter: "air filter",
    cabin_filter: "cabin filter",
    wiper: "wiper",
    bulb: "bulb",
    oil_filter: "oil filter",
    oil_capacity: "oil",
    wheel_torque: "torque"
  };
  const rows = await query<{ name: string; sku: string | null; product_id: string | null; inventory_item_id: string | null }>(
    `SELECT ti.name, ti.sku, ti.product_id, ti.inventory_item_id
     FROM ticket_items ti
     JOIN tickets t ON t.id = ti.ticket_id
     WHERE t.vehicle_id = ? AND ti.deleted_at IS NULL
       AND LOWER(COALESCE(ti.name, '') || ' ' || COALESCE(ti.sku, '') || ' ' || COALESCE(ti.product_id, '')) LIKE ?
     ORDER BY ti.created_at DESC
     LIMIT 5`,
    [vehicleId, `%${words[category] ?? ""}%`]
  );
  return rows.map((row) => ({
    category,
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    confidence: "medium",
    source: "ticket_history",
    raw: row
  }));
}

async function serviceSpecs(vehicleId?: string | null): Promise<SuggestedServiceSpec[]> {
  if (!vehicleId) return [];
  const vehicle = await getVehicleById(vehicleId).catch(() => null);
  const specs: SuggestedServiceSpec[] = [];
  if (vehicle?.oil_capacity) {
    specs.push({ category: "oil_capacity", value: vehicle.oil_capacity, unit: "qt", confidence: "high", source: "vehicle_default", raw: vehicle });
  }
  const history = await getOilChangeHistoryByVehicle(vehicleId, 5).catch(() => []);
  for (const entry of history) {
    try {
      const parsed = JSON.parse(entry.services_json) as { packageDetails?: { actual_quarts?: number; oil_type?: string } };
      if (parsed.packageDetails?.actual_quarts) {
        specs.push({ category: "oil_capacity", value: parsed.packageDetails.actual_quarts, unit: "qt", confidence: "medium", source: "service_history", raw: entry });
        break;
      }
    } catch {
      // Imported text history is still useful for notes, but not structured enough for capacity.
    }
  }
  return specs;
}

export async function getLocalHistoryFitment(request: PartFitmentRequest & { vehicleId?: string | null }): Promise<PartFitmentResult> {
  const vehicleId = request.vehicleId ?? null;
  let parts: SuggestedPart[] = [];
  if (request.category === "oil_filter") parts = await oilFilterSuggestions(vehicleId);
  else if (request.category !== "oil_capacity" && request.category !== "wheel_torque") parts = await priorItemSuggestions(vehicleId, request.category);

  if (!parts.length && request.category !== "oil_capacity" && request.category !== "wheel_torque") {
    const queryText = request.category.replace("_", " ");
    const inventory = await searchInventoryAdvanced(queryText, {}, 5, 0).catch(() => []);
    parts = inventory.map((item) => ({
      category: request.category,
      productId: item.product_id,
      sku: item.sku,
      brand: item.brand ?? item.vendor,
      name: item.product_type ?? item.name,
      confidence: "low",
      source: "local_inventory_search",
      raw: item
    }));
  }

  const specs = await serviceSpecs(vehicleId);
  return {
    ok: true,
    status: "ready",
    message: parts.length || specs.length ? "Local history suggestions loaded." : "No local fitment history found. Manual entry is available.",
    parts,
    specs
  };
}
