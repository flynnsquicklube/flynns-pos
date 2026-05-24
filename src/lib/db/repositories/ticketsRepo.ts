import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso, todayIsoDate } from "../../utils/dates";
import { calculateTicketTotals } from "../../pricing/pricingEngine";
import { createPayment } from "./paymentsRepo";
import { createServiceHistory } from "./serviceHistoryRepo";
import { updateVehicleAfterService } from "./vehiclesRepo";
import type { PaymentMethod } from "../../../types/payment";
import type { TicketPackageDetails, TicketPackageDetailsInput } from "../../../types/servicePackage";
import type { Ticket, TicketItem, TicketLineInput, TicketStatus, TicketWithDetails } from "../../../types/ticket";

export interface DashboardMetrics {
  todaySales: number;
  carCount: number;
  averageTicket: number;
  openTickets: number;
  lowInventory: number;
  vehicleCountToday: number;
  unpaidCompleted: number;
  waitingPayment: number;
  inService: number;
}

export interface CreateTicketInput {
  customer_id: string;
  vehicle_id: string;
  items: TicketLineInput[];
  customer_concern: string | null;
  technician_notes: string | null;
  internal_notes: string | null;
  taxRate: number;
  packageDetails?: TicketPackageDetailsInput | null;
}

export interface CompleteTicketInput {
  paymentMethod: PaymentMethod;
  paymentAmount?: number;
  finalMileage: number;
  oilType: string | null;
  reference?: string | null;
}

export interface TicketFilters {
  statuses?: TicketStatus[];
  includeCompletedTodayOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

function mapTicketRows(rows: TicketWithDetails[], items: TicketItem[]): TicketWithDetails[] {
  return rows.map((ticket) => ({
    ...ticket,
    items: items.filter((item) => item.ticket_id === ticket.id)
  }));
}

async function loadItems(ticketIds: string[]): Promise<TicketItem[]> {
  if (ticketIds.length === 0) return [];
  const placeholders = ticketIds.map(() => "?").join(",");
  return query<TicketItem>(`SELECT * FROM ticket_items WHERE deleted_at IS NULL AND ticket_id IN (${placeholders}) ORDER BY created_at ASC`, ticketIds);
}

async function loadPackageDetails(ticketId: string): Promise<TicketPackageDetails | null> {
  const rows = await query<TicketPackageDetails>("SELECT * FROM ticket_package_details WHERE ticket_id = ? AND deleted_at IS NULL", [ticketId]);
  return rows[0] ?? null;
}

export async function listTickets(): Promise<Ticket[]> {
  return query<Ticket>("SELECT * FROM tickets WHERE deleted_at IS NULL ORDER BY created_at DESC");
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const rows = await query<Ticket>("SELECT * FROM tickets WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function createTicketWithItems(input: CreateTicketInput): Promise<TicketWithDetails> {
  if (!input.customer_id) throw new Error("A customer is required.");
  if (!input.vehicle_id) throw new Error("A vehicle is required.");
  if (input.items.length === 0) throw new Error("At least one service or line item is required.");

  const id = createId("tkt");
  const timestamp = nowIso();
  const totals = calculateTicketTotals(input.items, input.taxRate);

  await execute(
    `INSERT INTO tickets (
      id, customer_id, vehicle_id, status, subtotal, discount_total, tax_total, fee_total,
      total, payment_status, notes, customer_concern, technician_notes, internal_notes,
      created_at, updated_at, completed_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, 'checked_in', ?, ?, ?, ?, ?, 'unpaid', NULL, ?, ?, ?, ?, ?, NULL, NULL, 'pending')`,
    [
      id,
      input.customer_id,
      input.vehicle_id,
      totals.subtotal,
      totals.discount_total,
      totals.tax_total,
      totals.fee_total,
      totals.total,
      input.customer_concern,
      input.technician_notes,
      input.internal_notes,
      timestamp,
      timestamp
    ]
  );

  for (const item of input.items) {
    await execute(
      `INSERT INTO ticket_items (
        id, ticket_id, service_id, item_type, package_id, inventory_item_id,
        name, quantity, unit_price, line_total, taxable,
        created_at, updated_at, deleted_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
      [
        createId("item"),
        id,
        item.service_id,
        item.item_type ?? (item.service_id ? "service" : "custom"),
        item.package_id ?? null,
        item.inventory_item_id ?? null,
        item.name,
        item.quantity,
        item.unit_price,
        Math.round(item.quantity * item.unit_price * 100) / 100,
        item.taxable,
        timestamp,
        timestamp
      ]
    );
  }

  if (input.packageDetails) {
    await execute(
      `INSERT INTO ticket_package_details (
        id, ticket_id, package_id, package_name, oil_brand, oil_type, included_quarts,
        actual_quarts, extra_quarts, extra_quart_price, extra_quart_total,
        filter_type, cartridge_filter_extra_fee, package_base_price, package_total,
        created_at, updated_at, deleted_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
      [
        createId("tpd"),
        id,
        input.packageDetails.package_id,
        input.packageDetails.package_name,
        input.packageDetails.oil_brand,
        input.packageDetails.oil_type,
        input.packageDetails.included_quarts,
        input.packageDetails.actual_quarts,
        input.packageDetails.extra_quarts,
        input.packageDetails.extra_quart_price,
        input.packageDetails.extra_quart_total,
        input.packageDetails.filter_type,
        input.packageDetails.cartridge_filter_extra_fee,
        input.packageDetails.package_base_price,
        input.packageDetails.package_total,
        timestamp,
        timestamp
      ]
    );
  }

  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket was not created.");
  return ticket;
}

export async function listTicketsWithDetails(filters: TicketFilters = {}): Promise<TicketWithDetails[]> {
  const today = `${todayIsoDate()}%`;
  const clauses = ["t.deleted_at IS NULL", "t.status != 'draft'"];
  const params: unknown[] = [];
  if (filters.statuses?.length) {
    clauses.push(`t.status IN (${filters.statuses.map(() => "?").join(",")})`);
    params.push(...filters.statuses);
  } else if (filters.includeCompletedTodayOnly !== false) {
    clauses.push("(t.status != 'completed' OR t.completed_at LIKE ?)");
    params.push(today);
  }
  if (filters.dateFrom) {
    clauses.push("t.created_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("t.created_at <= ?");
    params.push(filters.dateTo);
  }
  const tickets = await query<TicketWithDetails>(
    `SELECT
      t.*,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      v.year AS vehicle_year,
      v.make AS vehicle_make,
      v.model AS vehicle_model,
      v.mileage AS vehicle_mileage,
      v.oil_type AS vehicle_oil_type,
      v.plate AS vehicle_plate,
      v.vin AS vehicle_vin,
      v.plate_state AS vehicle_plate_state,
      (SELECT GROUP_CONCAT(name, ', ') FROM ticket_items WHERE ticket_id = t.id AND deleted_at IS NULL) AS service_names
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY t.created_at ASC`,
    params
  );
  const items = await loadItems(tickets.map((ticket) => ticket.id));
  return mapTicketRows(tickets, items);
}

export async function listOrderHistory(): Promise<TicketWithDetails[]> {
  const tickets = await query<TicketWithDetails>(
    `SELECT
      t.*,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      v.year AS vehicle_year,
      v.make AS vehicle_make,
      v.model AS vehicle_model,
      v.mileage AS vehicle_mileage,
      v.oil_type AS vehicle_oil_type,
      v.plate AS vehicle_plate,
      v.vin AS vehicle_vin,
      v.plate_state AS vehicle_plate_state,
      (SELECT GROUP_CONCAT(name, ', ') FROM ticket_items WHERE ticket_id = t.id AND deleted_at IS NULL) AS service_names
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.deleted_at IS NULL AND t.status != 'draft'
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC`
  );
  const items = await loadItems(tickets.map((ticket) => ticket.id));
  return mapTicketRows(tickets, items);
}

export async function listCompletedTickets(filters: { dateFrom?: string; dateTo?: string } = {}): Promise<TicketWithDetails[]> {
  const clauses = ["t.deleted_at IS NULL", "t.status IN ('completed', 'canceled')"];
  const params: unknown[] = [];
  if (filters.dateFrom) {
    clauses.push("COALESCE(t.completed_at, t.created_at) >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("COALESCE(t.completed_at, t.created_at) <= ?");
    params.push(filters.dateTo);
  }
  const tickets = await query<TicketWithDetails>(
    `SELECT
      t.*,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      v.year AS vehicle_year,
      v.make AS vehicle_make,
      v.model AS vehicle_model,
      v.mileage AS vehicle_mileage,
      v.oil_type AS vehicle_oil_type,
      v.plate AS vehicle_plate,
      v.vin AS vehicle_vin,
      v.plate_state AS vehicle_plate_state,
      (SELECT GROUP_CONCAT(name, ', ') FROM ticket_items WHERE ticket_id = t.id AND deleted_at IS NULL) AS service_names
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC`,
    params
  );
  return mapTicketRows(tickets, await loadItems(tickets.map((ticket) => ticket.id)));
}

export async function listActiveTickets(): Promise<TicketWithDetails[]> {
  return listTicketsWithDetails({ statuses: ["checked_in", "in_service", "waiting_payment"] });
}

export async function getTicketById(id: string): Promise<TicketWithDetails | null> {
  const rows = await query<TicketWithDetails>(
    `SELECT
      t.*,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      v.year AS vehicle_year,
      v.make AS vehicle_make,
      v.model AS vehicle_model,
      v.mileage AS vehicle_mileage,
      v.oil_type AS vehicle_oil_type,
      v.plate AS vehicle_plate,
      v.vin AS vehicle_vin,
      v.plate_state AS vehicle_plate_state,
      (SELECT GROUP_CONCAT(name, ', ') FROM ticket_items WHERE ticket_id = t.id AND deleted_at IS NULL) AS service_names
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.id = ? AND t.deleted_at IS NULL`,
    [id]
  );
  const ticket = rows[0];
  if (!ticket) return null;
  const items = await loadItems([id]);
  const packageDetails = await loadPackageDetails(id);
  return { ...ticket, items, packageDetails };
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
  await execute("UPDATE tickets SET status = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL", [status, nowIso(), id]);
}

export async function updateTicketBay(id: string, bay: string | null): Promise<void> {
  await execute("UPDATE tickets SET bay = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL", [bay, nowIso(), id]);
}

export async function updateTicketNotes(
  id: string,
  notes: { customer_concern?: string | null; technician_notes?: string | null; internal_notes?: string | null }
): Promise<void> {
  const current = await getTicketById(id);
  if (!current) throw new Error("Ticket not found.");
  await execute(
    "UPDATE tickets SET customer_concern = ?, technician_notes = ?, internal_notes = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [
      notes.customer_concern ?? current.customer_concern,
      notes.technician_notes ?? current.technician_notes,
      notes.internal_notes ?? current.internal_notes,
      nowIso(),
      id
    ]
  );
}

export async function completeTicket(id: string, input: CompleteTicketInput): Promise<void> {
  if (!input.paymentMethod) throw new Error("Payment method is required.");
  if (input.paymentAmount !== undefined && (!Number.isFinite(input.paymentAmount) || input.paymentAmount <= 0)) throw new Error("Payment amount is required.");
  if (!Number.isFinite(input.finalMileage) || input.finalMileage <= 0) throw new Error("Final mileage is required.");
  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status !== "waiting_payment") throw new Error("Ticket must be waiting payment before completion.");
  if (!ticket.vehicle_id) throw new Error("Ticket has no vehicle.");
  if (!ticket.customer_id) throw new Error("Ticket has no customer.");
  const timestamp = nowIso();

  await createPayment({
    ticket_id: id,
    method: input.paymentMethod,
    amount: input.paymentAmount ?? ticket.total,
    reference: input.reference ?? null,
    paid_at: timestamp
  });
  await updateVehicleAfterService(ticket.vehicle_id, input.finalMileage, input.oilType);
  await execute(
    "UPDATE tickets SET status = 'completed', payment_status = 'paid', completed_at = ?, bay = NULL, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [timestamp, timestamp, id]
  );
  await createServiceHistory({
    ticket_id: id,
    customer_id: ticket.customer_id,
    vehicle_id: ticket.vehicle_id,
    service_date: timestamp,
    mileage: input.finalMileage,
    oil_type: input.oilType,
    services_json: JSON.stringify(ticket.items.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total }))),
    notes: [ticket.customer_concern, ticket.technician_notes, ticket.internal_notes].filter(Boolean).join(" | ") || null
  });
}

export async function startService(ticketId: string, bay: string): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status !== "checked_in") throw new Error("Only checked-in tickets can start service.");
  await execute(
    "UPDATE tickets SET status = 'in_service', bay = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL",
    [bay, nowIso(), ticketId]
  );
}

export async function cancelTicket(id: string): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed") throw new Error("Completed tickets cannot be canceled.");
  await updateTicketStatus(id, "canceled");
}

export async function reopenTicket(id: string): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status !== "canceled") throw new Error("Only canceled tickets can be reopened.");
  await updateTicketStatus(id, "checked_in");
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const today = `${todayIsoDate()}%`;
  const [sales] = await query<{ total: number | null; count: number }>(
    "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM tickets WHERE completed_at LIKE ? AND deleted_at IS NULL AND status = 'completed'",
    [today]
  );
  const [open] = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM tickets WHERE status IN ('checked_in', 'in_service', 'waiting_payment') AND deleted_at IS NULL"
  );
  const [unpaidCompleted] = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM tickets WHERE status = 'completed' AND payment_status != 'paid' AND completed_at LIKE ? AND deleted_at IS NULL",
    [today]
  );
  const [waitingPayment] = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM tickets WHERE status = 'waiting_payment' AND deleted_at IS NULL"
  );
  const [inService] = await query<{ count: number }>("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_service' AND deleted_at IS NULL");
  const [lowInventory] = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM inventory_items WHERE deleted_at IS NULL AND active = 1 AND quantity_on_hand <= reorder_point"
  );

  const todaySales = sales?.total ?? 0;
  const carCount = sales?.count ?? 0;
  return {
    todaySales,
    carCount,
    averageTicket: carCount > 0 ? todaySales / carCount : 0,
    openTickets: open?.count ?? 0,
    lowInventory: lowInventory?.count ?? 0,
    vehicleCountToday: carCount,
    unpaidCompleted: unpaidCompleted?.count ?? 0,
    waitingPayment: waitingPayment?.count ?? 0,
    inService: inService?.count ?? 0
  };
}

export const getTodayDashboardMetrics = getDashboardMetrics;
