import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { InventoryItem } from "../../../types/inventory";

export type InventoryInput = Omit<InventoryItem, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;

export interface InventoryStats {
  totalItems: number;
  importedItems: number;
  lowStockItems: number;
  oilFilters: number;
  engineOils: number;
}

export interface InventorySearchFilters {
  lowStock?: boolean;
  oilFilters?: boolean;
  engineOil?: boolean;
  airFilters?: boolean;
  cabinFilters?: boolean;
  wipers?: boolean;
  imported?: boolean;
}

export async function listInventoryItems(search = ""): Promise<InventoryItem[]> {
  const like = `%${search.trim()}%`;
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND (? = '%%' OR sku LIKE ? OR product_id LIKE ? OR product_type LIKE ? OR name LIKE ? OR category LIKE ? OR vendor LIKE ? OR viscosity LIKE ? OR oil_formulation LIKE ? OR notes LIKE ?)
     ORDER BY name ASC`,
    [like, like, like, like, like, like, like, like, like, like]
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
      OR viscosity LIKE ?
      OR oil_formulation LIKE ?
      OR notes LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like, like, like);
  }
  if (filters.lowStock) clauses.push("quantity_on_hand <= reorder_point");
  if (filters.imported) clauses.push("COALESCE(is_imported, 0) = 1");
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
  return clauses.join(" AND ");
}

export async function getInventoryStats(): Promise<InventoryStats> {
  const [row] = await query<InventoryStats>(
    `SELECT
      COUNT(*) AS totalItems,
      COALESCE(SUM(CASE WHEN COALESCE(is_imported, 0) = 1 THEN 1 ELSE 0 END), 0) AS importedItems,
      COALESCE(SUM(CASE WHEN quantity_on_hand <= reorder_point THEN 1 ELSE 0 END), 0) AS lowStockItems,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '')) LIKE '%oil filter%' THEN 1 ELSE 0 END), 0) AS oilFilters,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(name, '') || ' ' || COALESCE(product_type, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(inventory_type, '')) LIKE '%engine oil%' THEN 1 ELSE 0 END), 0) AS engineOils
     FROM inventory_items
     WHERE deleted_at IS NULL`
  );
  return row ?? { totalItems: 0, importedItems: 0, lowStockItems: 0, oilFilters: 0, engineOils: 0 };
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
        OR notes LIKE ?
       )
     ORDER BY quantity_on_hand DESC, product_id ASC, sku ASC
     LIMIT ?`,
    [like, like, like, like, like, like, like, like, like, limit]
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
    [like, like, like, like, like, like, like, like, like, like, oilLike, oilLike, oilLike, oilLike, oilLike, limit]
  );
}

export async function createInventoryItem(input: InventoryInput): Promise<InventoryItem> {
  const id = createId("inv");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO inventory_items (
      id, sku, name, category, vendor, cost, retail_price, quantity_on_hand, reorder_point,
      barcode, active, notes, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.sku, input.name, input.category, input.vendor, input.cost, input.retail_price, input.quantity_on_hand, input.reorder_point, input.barcode, input.active, input.notes, timestamp, timestamp]
  );
  const item = await getInventoryItem(id);
  if (!item) throw new Error("Inventory item was not created.");
  return item;
}

export async function updateInventoryItem(id: string, input: Partial<InventoryInput>): Promise<void> {
  const current = await getInventoryItem(id);
  if (!current) throw new Error("Inventory item not found.");
  await execute(
    `UPDATE inventory_items SET
      sku = ?, name = ?, category = ?, vendor = ?, cost = ?, retail_price = ?,
      quantity_on_hand = ?, reorder_point = ?, barcode = ?, active = ?, notes = ?,
      updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.sku ?? current.sku,
      input.name ?? current.name,
      input.category ?? current.category,
      input.vendor ?? current.vendor,
      input.cost ?? current.cost,
      input.retail_price ?? current.retail_price,
      input.quantity_on_hand ?? current.quantity_on_hand,
      input.reorder_point ?? current.reorder_point,
      input.barcode ?? current.barcode,
      input.active ?? current.active,
      input.notes ?? current.notes,
      nowIso(),
      id
    ]
  );
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await execute("UPDATE inventory_items SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), nowIso(), id]);
}
