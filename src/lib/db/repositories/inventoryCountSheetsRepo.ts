import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { searchInventoryAdvanced, type InventorySearchFilters } from "./inventoryRepo";
import { adjustInventoryQuantity } from "./inventoryMovementsRepo";
import { writeAuditLog } from "./auditLogRepo";

export type CountSheetStatus = "draft" | "in_progress" | "completed" | "canceled";
export type CountSheetFilter = "all" | "oil_filters" | "engine_oil" | "low_stock" | "custom";

export interface InventoryCountSheet {
  id: string;
  name: string;
  status: CountSheetStatus;
  filter_type: CountSheetFilter | null;
  created_by_employee_id: string | null;
  completed_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  notes: string | null;
  item_count?: number;
}

export interface InventoryCountSheetItem {
  id: string;
  count_sheet_id: string;
  inventory_item_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  adjustment_applied: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product_id?: string | null;
  sku?: string | null;
  name?: string;
  product_type?: string | null;
}

function filtersForCountSheet(filter: CountSheetFilter): InventorySearchFilters {
  if (filter === "oil_filters") return { oilFilters: true };
  if (filter === "engine_oil") return { engineOil: true };
  if (filter === "low_stock") return { lowStock: true };
  return {};
}

export async function createCountSheet(input: { name: string; filter_type?: CountSheetFilter; notes?: string | null }): Promise<InventoryCountSheet> {
  const id = createId("count");
  const timestamp = nowIso();
  const employee = getCurrentEmployeeSnapshot();
  await execute(
    `INSERT INTO inventory_count_sheets (id, name, status, filter_type, created_by_employee_id, created_at, updated_at, notes)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
    [id, input.name.trim(), input.filter_type ?? "custom", employee.id, timestamp, timestamp, input.notes ?? null]
  );
  await addItemsToCountSheet(id, input.filter_type ?? "custom");
  const sheet = await getCountSheetById(id);
  if (!sheet) throw new Error("Count sheet was not created.");
  await writeAuditLog({ action: "inventory.count_sheet_created", entity_type: "inventory_count_sheet", entity_id: id, summary: `Created count sheet ${sheet.name}`, after: sheet });
  return sheet;
}

export async function addItemsToCountSheet(sheetId: string, filter: CountSheetFilter = "custom"): Promise<number> {
  const timestamp = nowIso();
  const items = await searchInventoryAdvanced("", filtersForCountSheet(filter), 500, 0);
  let added = 0;
  for (const item of items) {
    const id = createId("count_item");
    await execute(
      `INSERT INTO inventory_count_sheet_items (id, count_sheet_id, inventory_item_id, expected_quantity, counted_quantity, variance, adjustment_applied, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
      [id, sheetId, item.id, item.quantity_on_hand ?? 0, timestamp, timestamp]
    );
    added += 1;
  }
  return added;
}

export async function listCountSheets(): Promise<InventoryCountSheet[]> {
  return query<InventoryCountSheet>(
    `SELECT s.*, COUNT(i.id) AS item_count
     FROM inventory_count_sheets s
     LEFT JOIN inventory_count_sheet_items i ON i.count_sheet_id = s.id
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT 100`
  );
}

export async function getCountSheetById(id: string): Promise<InventoryCountSheet | null> {
  const rows = await query<InventoryCountSheet>("SELECT * FROM inventory_count_sheets WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function listCountSheetItems(sheetId: string): Promise<InventoryCountSheetItem[]> {
  return query<InventoryCountSheetItem>(
    `SELECT csi.*, ii.product_id, ii.sku, ii.name, ii.product_type
     FROM inventory_count_sheet_items csi
     JOIN inventory_items ii ON ii.id = csi.inventory_item_id
     WHERE csi.count_sheet_id = ?
     ORDER BY ii.product_id ASC, ii.name ASC`,
    [sheetId]
  );
}

export async function updateCountedQuantity(sheetItemId: string, quantity: number): Promise<void> {
  const [item] = await query<InventoryCountSheetItem>("SELECT * FROM inventory_count_sheet_items WHERE id = ?", [sheetItemId]);
  if (!item) throw new Error("Count sheet item not found.");
  const counted = Number(quantity);
  if (!Number.isFinite(counted) || counted < 0) throw new Error("Enter a valid counted quantity.");
  const variance = counted - (Number(item.expected_quantity) || 0);
  await execute(
    "UPDATE inventory_count_sheet_items SET counted_quantity = ?, variance = ?, updated_at = ? WHERE id = ?",
    [counted, variance, nowIso(), sheetItemId]
  );
}

export async function completeCountSheet(sheetId: string): Promise<void> {
  const employee = getCurrentEmployeeSnapshot();
  const timestamp = nowIso();
  await execute(
    "UPDATE inventory_count_sheets SET status = 'completed', completed_by_employee_id = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    [employee.id, timestamp, timestamp, sheetId]
  );
  await writeAuditLog({ action: "inventory.count_sheet_completed", entity_type: "inventory_count_sheet", entity_id: sheetId, summary: "Completed inventory count sheet" });
}

export async function applyCountSheetAdjustments(sheetId: string): Promise<number> {
  const items = await listCountSheetItems(sheetId);
  let applied = 0;
  for (const item of items) {
    if (item.adjustment_applied || item.counted_quantity == null || !item.variance) continue;
    await adjustInventoryQuantity({
      inventory_item_id: item.inventory_item_id,
      movement_type: "set",
      quantity: item.counted_quantity,
      reason: "Inventory Count",
      notes: `Count sheet ${sheetId}`
    });
    await execute("UPDATE inventory_count_sheet_items SET adjustment_applied = 1, updated_at = ? WHERE id = ?", [nowIso(), item.id]);
    applied += 1;
  }
  await writeAuditLog({ action: "inventory.count_sheet_adjustments_applied", entity_type: "inventory_count_sheet", entity_id: sheetId, summary: `Applied ${applied} inventory count adjustments` });
  return applied;
}
