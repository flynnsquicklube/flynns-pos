import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { writeAuditLog } from "./auditLogRepo";
import type { InventoryItem } from "../../../types/inventory";

export type InventoryInput = Omit<InventoryItem, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;

export interface InventoryStats {
  totalItems: number;
  importedItems: number;
  lowStockItems: number;
  oilFilters: number;
  engineOils: number;
  costValue: number;
  retailValue: number;
}

export interface InventoryAdminMetrics extends InventoryStats {
  estimatedMarginValue: number;
  negativeStockItems: number;
  adjustmentCount: number;
  adjustmentValue: number;
  oilFilterStock: number;
  engineOilStock: number;
}

export interface InventorySearchFilters {
  lowStock?: boolean;
  oilFilters?: boolean;
  engineOil?: boolean;
  airFilters?: boolean;
  cabinFilters?: boolean;
  wipers?: boolean;
  fluids?: boolean;
  imported?: boolean;
  active?: boolean;
  inactive?: boolean;
}

export async function listInventoryItems(search = ""): Promise<InventoryItem[]> {
  const like = `%${search.trim()}%`;
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND (? = '%%' OR sku LIKE ? OR product_id LIKE ? OR product_type LIKE ? OR name LIKE ? OR category LIKE ? OR vendor LIKE ? OR brand LIKE ? OR supplier LIKE ? OR viscosity LIKE ? OR oil_formulation LIKE ? OR notes LIKE ?)
     ORDER BY name ASC`,
    [like, like, like, like, like, like, like, like, like, like, like, like]
  );
}

function inventorySearchWhere(queryText: string, filters: InventorySearchFilters, params: unknown[]) {
  const clauses = ["deleted_at IS NULL"];
  const trimmed = queryText.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    clauses.push(`(
      sku LIKE ?
      OR product_id LIKE ?
      OR barcode LIKE ?
      OR name LIKE ?
      OR product_type LIKE ?
      OR inventory_type LIKE ?
      OR category LIKE ?
      OR vendor LIKE ?
      OR brand LIKE ?
      OR supplier LIKE ?
      OR viscosity LIKE ?
      OR oil_formulation LIKE ?
      OR notes LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like, like, like, like, like);
  }
  if (filters.lowStock) clauses.push("((COALESCE(reorder_point, 0) > 0 AND quantity_on_hand <= reorder_point) OR (COALESCE(min_quantity, 0) > 0 AND quantity_on_hand <= min_quantity) OR (COALESCE(trackable, 1) = 1 AND quantity_on_hand = 0))");
  if (filters.imported) clauses.push("COALESCE(is_imported, 0) = 1");
  if (filters.active) clauses.push("COALESCE(active, 1) = 1");
  if (filters.inactive) clauses.push("COALESCE(active, 1) = 0");
  if (filters.oilFilters) {
    clauses.push("(name LIKE ? OR product_type LIKE ? OR category LIKE ? OR notes LIKE ?)");
    params.push("%oil filter%", "%oil filter%", "%filter%", "%oil filter%");
  }
  if (filters.engineOil) {
    clauses.push("(name LIKE ? OR product_type LIKE ? OR category LIKE ? OR inventory_type LIKE ?)");
    params.push("%engine oil%", "%engine oil%", "%oil%", "%oil%");
  }
  if (filters.airFilters) {
    clauses.push("(name LIKE ? OR product_type LIKE ? OR category LIKE ?)");
    params.push("%air filter%", "%air filter%", "%filter%");
  }
  if (filters.cabinFilters) {
    clauses.push("(name LIKE ? OR product_type LIKE ?)");
    params.push("%cabin%", "%cabin%");
  }
  if (filters.wipers) {
    clauses.push("(name LIKE ? OR product_type LIKE ? OR category LIKE ?)");
    params.push("%wiper%", "%wiper%", "%wiper%");
  }
  if (filters.fluids) {
    clauses.push(`(
      name LIKE ? OR product_type LIKE ? OR category LIKE ? OR inventory_type LIKE ?
      OR name LIKE ? OR product_type LIKE ? OR category LIKE ? OR inventory_type LIKE ?
      OR name LIKE ? OR product_type LIKE ? OR category LIKE ? OR inventory_type LIKE ?
      OR name LIKE ? OR product_type LIKE ? OR category LIKE ? OR inventory_type LIKE ?
      OR name LIKE ? OR product_type LIKE ? OR category LIKE ? OR inventory_type LIKE ?
    )`);
    params.push(
      "%fluid%", "%fluid%", "%fluid%", "%fluid%",
      "%coolant%", "%coolant%", "%coolant%", "%coolant%",
      "%brake%", "%brake%", "%brake%", "%brake%",
      "%power steering%", "%power steering%", "%power steering%", "%power steering%",
      "%washer%", "%washer%", "%washer%", "%washer%"
    );
  }
  return clauses.join(" AND ");
}

export async function getInventoryStats(): Promise<InventoryStats> {
  const [row] = await query<InventoryStats>(
    `SELECT
      COUNT(*) AS totalItems,
      COALESCE(SUM(CASE WHEN COALESCE(is_imported, 0) = 1 THEN 1 ELSE 0 END), 0) AS importedItems,
      COALESCE(SUM(CASE WHEN (COALESCE(reorder_point, 0) > 0 AND quantity_on_hand <= reorder_point) OR (COALESCE(min_quantity, 0) > 0 AND quantity_on_hand <= min_quantity) OR (COALESCE(trackable, 1) = 1 AND quantity_on_hand = 0) THEN 1 ELSE 0 END), 0) AS lowStockItems,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '')) LIKE '%oil filter%' THEN 1 ELSE 0 END), 0) AS oilFilters,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(inventory_type, '')) LIKE '%engine oil%' THEN 1 ELSE 0 END), 0) AS engineOils,
      COALESCE(SUM(COALESCE(quantity_on_hand, 0) * COALESCE(cost, 0)), 0) AS costValue,
      COALESCE(SUM(COALESCE(quantity_on_hand, 0) * COALESCE(retail_price, 0)), 0) AS retailValue
     FROM inventory_items
     WHERE deleted_at IS NULL`
  );
  return row ?? { totalItems: 0, importedItems: 0, lowStockItems: 0, oilFilters: 0, engineOils: 0, costValue: 0, retailValue: 0 };
}

export async function getInventoryAdminMetrics(): Promise<InventoryAdminMetrics> {
  const stats = await getInventoryStats();
  const [row] = await query<{
    negativeStockItems: number;
    adjustmentCount: number;
    adjustmentValue: number;
    oilFilterStock: number;
    engineOilStock: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN ii.quantity_on_hand < 0 THEN 1 ELSE 0 END), 0) AS negativeStockItems,
      (SELECT COUNT(*) FROM inventory_movements) AS adjustmentCount,
      (SELECT COALESCE(SUM(ABS(im.quantity_change) * COALESCE(inv.cost, 0)), 0)
         FROM inventory_movements im
         JOIN inventory_items inv ON inv.id = im.inventory_item_id) AS adjustmentValue,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(ii.name, '') || ' ' || COALESCE(ii.product_type, '') || ' ' || COALESCE(ii.category, '')) LIKE '%oil filter%' THEN ii.quantity_on_hand ELSE 0 END), 0) AS oilFilterStock,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(ii.name, '') || ' ' || COALESCE(ii.product_type, '') || ' ' || COALESCE(ii.category, '') || ' ' || COALESCE(ii.inventory_type, '')) LIKE '%engine oil%' THEN ii.quantity_on_hand ELSE 0 END), 0) AS engineOilStock
     FROM inventory_items ii
     WHERE ii.deleted_at IS NULL`
  );
  return {
    ...stats,
    estimatedMarginValue: Math.max((stats.retailValue || 0) - (stats.costValue || 0), 0),
    negativeStockItems: row?.negativeStockItems ?? 0,
    adjustmentCount: row?.adjustmentCount ?? 0,
    adjustmentValue: row?.adjustmentValue ?? 0,
    oilFilterStock: row?.oilFilterStock ?? 0,
    engineOilStock: row?.engineOilStock ?? 0
  };
}

export async function searchInventoryAdvanced(queryText = "", filters: InventorySearchFilters = {}, limit = 50, offset = 0): Promise<InventoryItem[]> {
  const params: unknown[] = [];
  const where = inventorySearchWhere(queryText, filters, params);
  params.push(limit, offset);
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE ${where}
     ORDER BY updated_at DESC, name ASC
     LIMIT ? OFFSET ?`,
    params
  );
}

export async function listRecentlyActiveInventory(limit = 25): Promise<InventoryItem[]> {
  return searchInventoryAdvanced("", {}, limit, 0);
}

export async function countInventorySearchResults(queryText = "", filters: InventorySearchFilters = {}): Promise<number> {
  const params: unknown[] = [];
  const where = inventorySearchWhere(queryText, filters, params);
  const [row] = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM inventory_items WHERE ${where}`, params);
  return row?.count ?? 0;
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const rows = await query<InventoryItem>("SELECT * FROM inventory_items WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export const getInventoryItemById = getInventoryItem;

export async function findInventoryItemBySkuOrProductId(value: string): Promise<InventoryItem | null> {
  const normalized = value.trim();
  if (!normalized) return null;
  const rows = await query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND active = 1
       AND (
        sku = ?
        OR product_id = ?
        OR barcode = ?
        OR REPLACE(UPPER(COALESCE(sku, '')), ' ', '') = REPLACE(UPPER(?), ' ', '')
        OR REPLACE(UPPER(COALESCE(product_id, '')), ' ', '') = REPLACE(UPPER(?), ' ', '')
        OR REPLACE(UPPER(COALESCE(barcode, '')), ' ', '') = REPLACE(UPPER(?), ' ', '')
       )
     ORDER BY quantity_on_hand DESC, updated_at DESC
     LIMIT 1`,
    [normalized, normalized, normalized, normalized, normalized, normalized]
  );
  return rows[0] ?? null;
}

export async function findOilFilterBySkuOrProductId(sku: string): Promise<InventoryItem | null> {
  const normalized = sku.trim();
  if (!normalized) return null;
  const rows = await query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND active = 1
       AND (
        sku = ?
        OR product_id = ?
        OR REPLACE(UPPER(COALESCE(sku, '')), ' ', '') = REPLACE(UPPER(?), ' ', '')
        OR REPLACE(UPPER(COALESCE(product_id, '')), ' ', '') = REPLACE(UPPER(?), ' ', '')
        OR REPLACE(UPPER(COALESCE(barcode, '')), ' ', '') = REPLACE(UPPER(?), ' ', '')
       )
       AND (
        LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(notes, '')) LIKE '%filter%'
        OR UPPER(COALESCE(product_id, '')) LIKE 'OF%'
        OR UPPER(COALESCE(sku, '')) LIKE 'OF%'
       )
     ORDER BY quantity_on_hand DESC, updated_at DESC
     LIMIT 1`,
    [normalized, normalized, normalized, normalized, normalized]
  );
  return rows[0] ?? null;
}

export async function searchOilFilters(queryText = "", limit = 25): Promise<InventoryItem[]> {
  const like = `%${queryText.trim()}%`;
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND active = 1
       AND (
        LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(inventory_type, '') || ' ' || COALESCE(notes, '')) LIKE '%oil filter%'
        OR LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(inventory_type, '') || ' ' || COALESCE(notes, '')) LIKE '%engine oil filter%'
        OR UPPER(COALESCE(product_id, '')) LIKE 'OF%'
        OR UPPER(COALESCE(sku, '')) LIKE 'OF%'
       )
       AND (
        ? = '%%'
        OR sku LIKE ?
        OR product_id LIKE ?
        OR barcode LIKE ?
        OR name LIKE ?
        OR product_type LIKE ?
        OR inventory_type LIKE ?
        OR vendor LIKE ?
        OR brand LIKE ?
        OR supplier LIKE ?
        OR notes LIKE ?
       )
     ORDER BY quantity_on_hand DESC, product_id ASC, sku ASC
     LIMIT ?`,
    [like, like, like, like, like, like, like, like, like, like, like, limit]
  );
}

export async function searchOilFiltersForVehicle(vehicle: { make?: string | null; model?: string | null }, limit = 8): Promise<InventoryItem[]> {
  const make = vehicle.make?.trim();
  const model = vehicle.model?.trim();
  const params: unknown[] = [];
  const clauses = [
    "deleted_at IS NULL",
    "active = 1",
    `(
      LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(notes, '')) LIKE '%oil filter%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(notes, '')) LIKE '%engine oil filter%'
      OR UPPER(COALESCE(product_id, '')) LIKE 'OF%'
      OR UPPER(COALESCE(sku, '')) LIKE 'OF%'
    )`
  ];
  if (make) {
    clauses.push("(notes LIKE ? OR name LIKE ?)");
    params.push(`%${make}%`, `%${make}%`);
  }
  if (model) {
    clauses.push("(notes LIKE ? OR name LIKE ?)");
    params.push(`%${model}%`, `%${model}%`);
  }
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE ${clauses.join(" AND ")}
     ORDER BY quantity_on_hand DESC, retail_price ASC
     LIMIT ?`,
    [...params, limit]
  );
}

export async function searchEngineOil(queryText = "", oilType = "", limit = 25): Promise<InventoryItem[]> {
  const like = `%${queryText.trim()}%`;
  const oilLike = `%${oilType.trim()}%`;
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND active = 1
       AND (
        LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(inventory_type, '') || ' ' || COALESCE(notes, '')) LIKE '%engine oil%'
        OR LOWER(COALESCE(category, '') || ' ' || COALESCE(inventory_type, '')) LIKE '%oil%'
        OR viscosity IS NOT NULL
        OR oil_formulation IS NOT NULL
       )
       AND (
        ? = '%%'
        OR sku LIKE ?
        OR product_id LIKE ?
        OR barcode LIKE ?
        OR name LIKE ?
        OR product_type LIKE ?
       OR vendor LIKE ?
        OR brand LIKE ?
        OR supplier LIKE ?
       OR viscosity LIKE ?
        OR oil_formulation LIKE ?
        OR notes LIKE ?
       )
       AND (
        ? = '%%'
        OR oil_formulation LIKE ?
        OR viscosity LIKE ?
        OR name LIKE ?
        OR notes LIKE ?
       )
     ORDER BY
       CASE WHEN quantity_on_hand > 0 THEN 0 ELSE 1 END,
       quantity_on_hand DESC,
       product_id ASC,
       sku ASC
     LIMIT ?`,
    [like, like, like, like, like, like, like, like, like, like, like, like, oilLike, oilLike, oilLike, oilLike, oilLike, limit]
  );
}

export async function createInventoryItem(input: InventoryInput): Promise<InventoryItem> {
  const id = createId("inv");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO inventory_items (
      id, sku, product_id, name, product_type, category, inventory_type, vendor, brand, supplier,
      measurement, viscosity, oil_formulation, cost, retail_price, replacement_cost, avg_cost,
      quantity_on_hand, quantity_sold_last_30_days, reorder_point, min_quantity, max_quantity,
      barcode, tax_exempt, trackable, sellable, replenishable, active, notes,
      external_source, external_id, is_imported, original_import_json,
      created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      id,
      input.sku ?? input.product_id ?? null,
      input.product_id ?? input.sku ?? null,
      input.name,
      input.product_type ?? input.name,
      input.category,
      input.inventory_type ?? input.category,
      input.vendor ?? input.brand ?? input.supplier ?? null,
      input.brand ?? input.vendor ?? null,
      input.supplier ?? input.vendor ?? null,
      input.measurement ?? null,
      input.viscosity ?? null,
      input.oil_formulation ?? null,
      input.cost ?? 0,
      input.retail_price ?? 0,
      input.replacement_cost ?? null,
      input.avg_cost ?? null,
      input.quantity_on_hand ?? 0,
      input.quantity_sold_last_30_days ?? null,
      input.reorder_point ?? input.min_quantity ?? 0,
      input.min_quantity ?? input.reorder_point ?? null,
      input.max_quantity ?? null,
      input.barcode ?? null,
      input.tax_exempt ?? 0,
      input.trackable ?? 1,
      input.sellable ?? 1,
      input.replenishable ?? 1,
      input.active ?? 1,
      input.notes ?? null,
      input.external_source ?? null,
      input.external_id ?? null,
      input.is_imported ?? 0,
      input.original_import_json ?? null,
      timestamp,
      timestamp
    ]
  );
  const item = await getInventoryItem(id);
  if (!item) throw new Error("Inventory item was not created.");
  await writeAuditLog({ action: "inventory.created", entity_type: "inventory_item", entity_id: id, summary: `Created inventory item ${item.name}`, after: item });
  return item;
}

export async function updateInventoryItem(id: string, input: Partial<InventoryInput>): Promise<void> {
  const current = await getInventoryItem(id);
  if (!current) throw new Error("Inventory item not found.");
  await execute(
    `UPDATE inventory_items SET
      sku = ?, product_id = ?, name = ?, product_type = ?, category = ?, inventory_type = ?,
      vendor = ?, brand = ?, supplier = ?, measurement = ?, viscosity = ?, oil_formulation = ?,
      cost = ?, retail_price = ?, replacement_cost = ?, avg_cost = ?,
      quantity_on_hand = ?, quantity_sold_last_30_days = ?, reorder_point = ?, min_quantity = ?, max_quantity = ?,
      barcode = ?, tax_exempt = ?, trackable = ?, sellable = ?, replenishable = ?, active = ?, notes = ?,
      updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.sku ?? current.sku,
      input.product_id ?? current.product_id ?? input.sku ?? current.sku,
      input.name ?? current.name,
      input.product_type ?? current.product_type ?? input.name ?? current.name,
      input.category ?? current.category,
      input.inventory_type ?? current.inventory_type ?? input.category ?? current.category,
      input.vendor ?? current.vendor,
      input.brand ?? current.brand ?? input.vendor ?? current.vendor,
      input.supplier ?? current.supplier ?? input.vendor ?? current.vendor,
      input.measurement ?? current.measurement ?? null,
      input.viscosity ?? current.viscosity ?? null,
      input.oil_formulation ?? current.oil_formulation ?? null,
      input.cost ?? current.cost,
      input.retail_price ?? current.retail_price,
      input.replacement_cost ?? current.replacement_cost ?? null,
      input.avg_cost ?? current.avg_cost ?? null,
      input.quantity_on_hand ?? current.quantity_on_hand,
      input.quantity_sold_last_30_days ?? current.quantity_sold_last_30_days ?? null,
      input.reorder_point ?? current.reorder_point,
      input.min_quantity ?? current.min_quantity ?? null,
      input.max_quantity ?? current.max_quantity ?? null,
      input.barcode ?? current.barcode,
      input.tax_exempt ?? current.tax_exempt ?? 0,
      input.trackable ?? current.trackable ?? 1,
      input.sellable ?? current.sellable ?? 1,
      input.replenishable ?? current.replenishable ?? 1,
      input.active ?? current.active,
      input.notes ?? current.notes,
      nowIso(),
      id
    ]
  );
  await writeAuditLog({ action: "inventory.updated", entity_type: "inventory_item", entity_id: id, summary: `Updated inventory item ${input.name ?? current.name}`, before: current, after: input });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await execute("UPDATE inventory_items SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), nowIso(), id]);
}

export { adjustInventoryQuantity } from "./inventoryMovementsRepo";
