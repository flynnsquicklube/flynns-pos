import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { ServiceCatalogItem, ServiceCatalogItemInput } from "../../../types/catalog";

export interface CatalogFilters {
  category?: string;
  activeOnly?: boolean;
  query?: string;
}

export async function listCatalogItems(filters: CatalogFilters = {}): Promise<ServiceCatalogItem[]> {
  const clauses = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.activeOnly) clauses.push("active = 1");
  if (filters.category) {
    clauses.push("category = ?");
    params.push(filters.category);
  }
  if (filters.query?.trim()) {
    const value = `%${filters.query.trim()}%`;
    clauses.push("(name LIKE ? OR category LIKE ? OR sku LIKE ? OR description LIKE ?)");
    params.push(value, value, value, value);
  }
  return query<ServiceCatalogItem>(
    `SELECT * FROM service_catalog_items WHERE ${clauses.join(" AND ")} ORDER BY category ASC, sort_order ASC, name ASC`,
    params
  );
}

export async function listActiveCatalogItems(): Promise<ServiceCatalogItem[]> {
  return listCatalogItems({ activeOnly: true });
}

export async function getCatalogItemById(id: string): Promise<ServiceCatalogItem | null> {
  const rows = await query<ServiceCatalogItem>("SELECT * FROM service_catalog_items WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function createCatalogItem(input: ServiceCatalogItemInput): Promise<ServiceCatalogItem> {
  const id = createId("cat");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO service_catalog_items (
      id, name, category, description, sku, base_price, cost, taxable, active,
      is_oil_change, is_fee, is_discount, inventory_item_id, sort_order,
      created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      id,
      input.name,
      input.category,
      input.description ?? null,
      input.sku ?? null,
      input.base_price,
      input.cost ?? null,
      input.taxable ?? 1,
      input.active ?? 1,
      input.is_oil_change ?? 0,
      input.is_fee ?? 0,
      input.is_discount ?? 0,
      input.inventory_item_id ?? null,
      input.sort_order ?? 0,
      timestamp,
      timestamp
    ]
  );
  const item = await getCatalogItemById(id);
  if (!item) throw new Error("Catalog item was not created.");
  return item;
}

export async function updateCatalogItem(id: string, input: Partial<ServiceCatalogItemInput>): Promise<void> {
  const current = await getCatalogItemById(id);
  if (!current) throw new Error("Catalog item not found.");
  await execute(
    `UPDATE service_catalog_items SET
      name = ?, category = ?, description = ?, sku = ?, base_price = ?, cost = ?,
      taxable = ?, active = ?, is_oil_change = ?, is_fee = ?, is_discount = ?,
      inventory_item_id = ?, sort_order = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.name ?? current.name,
      input.category ?? current.category,
      input.description ?? current.description,
      input.sku ?? current.sku,
      input.base_price ?? current.base_price,
      input.cost ?? current.cost,
      input.taxable ?? current.taxable,
      input.active ?? current.active,
      input.is_oil_change ?? current.is_oil_change,
      input.is_fee ?? current.is_fee,
      input.is_discount ?? current.is_discount,
      input.inventory_item_id ?? current.inventory_item_id,
      input.sort_order ?? current.sort_order,
      nowIso(),
      id
    ]
  );
}

export async function deactivateCatalogItem(id: string): Promise<void> {
  await execute("UPDATE service_catalog_items SET active = 0, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), id]);
}
