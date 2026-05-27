import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { getInventoryItemById } from "./inventoryRepo";
import { adjustInventoryQuantity } from "./inventoryMovementsRepo";
import { writeAuditLog } from "./auditLogRepo";

export type PurchaseOrderStatus = "draft" | "ordered" | "partially_received" | "received" | "canceled";

export interface PurchaseOrder {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number;
  notes: string | null;
  created_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  product_id: string | null;
  name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

async function recalcPurchaseOrderSubtotal(id: string) {
  const [row] = await query<{ subtotal: number }>("SELECT COALESCE(SUM(line_total), 0) AS subtotal FROM purchase_order_items WHERE purchase_order_id = ?", [id]);
  await execute("UPDATE purchase_orders SET subtotal = ?, updated_at = ? WHERE id = ?", [row?.subtotal ?? 0, nowIso(), id]);
}

export async function createPurchaseOrder(input: { supplier_id?: string | null; supplier_name?: string | null; notes?: string | null }): Promise<PurchaseOrder> {
  const id = createId("po");
  const timestamp = nowIso();
  const employee = getCurrentEmployeeSnapshot();
  await execute(
    `INSERT INTO purchase_orders (id, supplier_id, supplier_name, status, order_date, subtotal, notes, created_by_employee_id, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, 0, ?, ?, ?, ?)`,
    [id, input.supplier_id ?? null, input.supplier_name ?? null, timestamp, input.notes ?? null, employee.id, timestamp, timestamp]
  );
  const order = await getPurchaseOrderById(id);
  if (!order) throw new Error("Purchase order was not created.");
  await writeAuditLog({ action: "inventory.purchase_order_created", entity_type: "purchase_order", entity_id: id, summary: "Created purchase order", after: order });
  return order;
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  return query<PurchaseOrder>(
    `SELECT po.*, COUNT(poi.id) AS item_count
     FROM purchase_orders po
     LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
     GROUP BY po.id
     ORDER BY po.created_at DESC
     LIMIT 100`
  );
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  const rows = await query<PurchaseOrder>("SELECT * FROM purchase_orders WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function listPurchaseOrderItems(orderId: string): Promise<PurchaseOrderItem[]> {
  return query<PurchaseOrderItem>("SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY created_at ASC", [orderId]);
}

export async function addPurchaseOrderItem(input: { purchase_order_id: string; inventory_item_id: string; quantity_ordered: number; unit_cost?: number | null }): Promise<PurchaseOrderItem> {
  const item = await getInventoryItemById(input.inventory_item_id);
  if (!item) throw new Error("Inventory item not found.");
  const quantity = Number(input.quantity_ordered);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity ordered must be greater than zero.");
  const unitCost = Number(input.unit_cost ?? item.cost ?? 0);
  const id = createId("po_item");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO purchase_order_items (id, purchase_order_id, inventory_item_id, product_id, name, quantity_ordered, quantity_received, unit_cost, line_total, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [id, input.purchase_order_id, item.id, item.product_id ?? item.sku ?? null, item.name, quantity, unitCost, quantity * unitCost, timestamp, timestamp]
  );
  await recalcPurchaseOrderSubtotal(input.purchase_order_id);
  const [created] = await query<PurchaseOrderItem>("SELECT * FROM purchase_order_items WHERE id = ?", [id]);
  return created;
}

export async function updatePurchaseOrderItem(id: string, input: { quantity_ordered?: number; unit_cost?: number }): Promise<void> {
  const [current] = await query<PurchaseOrderItem>("SELECT * FROM purchase_order_items WHERE id = ?", [id]);
  if (!current) throw new Error("Purchase order item not found.");
  const quantity = input.quantity_ordered ?? current.quantity_ordered;
  const unitCost = input.unit_cost ?? current.unit_cost;
  await execute(
    "UPDATE purchase_order_items SET quantity_ordered = ?, unit_cost = ?, line_total = ?, updated_at = ? WHERE id = ?",
    [quantity, unitCost, quantity * unitCost, nowIso(), id]
  );
  await recalcPurchaseOrderSubtotal(current.purchase_order_id);
}

export async function markOrdered(id: string): Promise<void> {
  await execute("UPDATE purchase_orders SET status = 'ordered', order_date = COALESCE(order_date, ?), updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
}

export async function receivePurchaseOrderItems(id: string): Promise<number> {
  const items = await listPurchaseOrderItems(id);
  let received = 0;
  for (const item of items) {
    const remaining = Math.max((Number(item.quantity_ordered) || 0) - (Number(item.quantity_received) || 0), 0);
    if (remaining <= 0) continue;
    await adjustInventoryQuantity({
      inventory_item_id: item.inventory_item_id,
      movement_type: "add",
      quantity: remaining,
      reason: "Received Stock",
      notes: `Purchase Order ${id}`
    });
    await execute("UPDATE purchase_order_items SET quantity_received = quantity_ordered, updated_at = ? WHERE id = ?", [nowIso(), item.id]);
    received += 1;
  }
  await markReceived(id);
  return received;
}

export async function markReceived(id: string): Promise<void> {
  await execute("UPDATE purchase_orders SET status = 'received', received_date = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), id]);
  await writeAuditLog({ action: "inventory.purchase_order_received", entity_type: "purchase_order", entity_id: id, summary: "Received purchase order" });
}

export async function cancelPurchaseOrder(id: string): Promise<void> {
  await execute("UPDATE purchase_orders SET status = 'canceled', updated_at = ? WHERE id = ?", [nowIso(), id]);
}
