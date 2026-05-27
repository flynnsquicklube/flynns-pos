import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { writeAuditLog } from "./auditLogRepo";
import type { InventoryItem } from "../../../types/inventory";

export type InventoryMovementType = "add" | "remove" | "set";

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  employee_id?: string | null;
  sync_status: string;
}

export interface InventoryMovementInput {
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface AdjustInventoryQuantityInput {
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export async function createInventoryMovement(input: InventoryMovementInput): Promise<InventoryMovement> {
  const id = createId("mov");
  const timestamp = nowIso();
  const employee = getCurrentEmployeeSnapshot();
  await execute(
    `INSERT INTO inventory_movements (
      id, inventory_item_id, movement_type, quantity_before, quantity_change,
      quantity_after, reason, notes, created_at, created_by, employee_id, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.inventory_item_id,
      input.movement_type,
      input.quantity_before,
      input.quantity_change,
      input.quantity_after,
      input.reason ?? null,
      input.notes ?? null,
      timestamp,
      input.created_by ?? employee.display_name,
      employee.id
    ]
  );
  const rows = await query<InventoryMovement>("SELECT * FROM inventory_movements WHERE id = ?", [id]);
  const movement = rows[0];
  if (!movement) throw new Error("Inventory movement was not created.");
  await writeAuditLog({ action: "inventory.quantity_adjusted", entity_type: "inventory_item", entity_id: input.inventory_item_id, summary: `Inventory ${input.movement_type}: ${input.quantity_change}`, after: movement });
  return movement;
}

export async function listInventoryMovementsByItem(itemId: string, limit = 25): Promise<InventoryMovement[]> {
  return query<InventoryMovement>(
    `SELECT * FROM inventory_movements
     WHERE inventory_item_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [itemId, limit]
  );
}

export async function adjustInventoryQuantity(input: AdjustInventoryQuantityInput): Promise<InventoryMovement> {
  const rows = await query<InventoryItem>("SELECT * FROM inventory_items WHERE id = ? AND deleted_at IS NULL", [input.inventory_item_id]);
  const item = rows[0] ?? null;
  if (!item) throw new Error("Inventory item not found.");
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Enter a valid quantity.");

  const before = Number(item.quantity_on_hand) || 0;
  const change = input.movement_type === "add" ? quantity : input.movement_type === "remove" ? -quantity : quantity - before;
  const after = Math.max(before + change, 0);

  await execute(
    "UPDATE inventory_items SET quantity_on_hand = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL",
    [after, nowIso(), item.id]
  );
  return createInventoryMovement({
    inventory_item_id: item.id,
    movement_type: input.movement_type,
    quantity_before: before,
    quantity_change: change,
    quantity_after: after,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
    created_by: input.created_by ?? null
  });
}
