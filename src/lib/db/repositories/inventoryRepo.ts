import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { InventoryItem } from "../../../types/inventory";

export type InventoryInput = Omit<InventoryItem, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;

export async function listInventoryItems(search = ""): Promise<InventoryItem[]> {
  const like = `%${search.trim()}%`;
  return query<InventoryItem>(
    `SELECT * FROM inventory_items
     WHERE deleted_at IS NULL
       AND (? = '%%' OR sku LIKE ? OR name LIKE ? OR category LIKE ? OR vendor LIKE ?)
     ORDER BY name ASC`,
    [like, like, like, like, like]
  );
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const rows = await query<InventoryItem>("SELECT * FROM inventory_items WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
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
