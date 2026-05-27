import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso, todayIsoDate } from "../../utils/dates";
import { calculateTicketTotals } from "../../pricing/pricingEngine";
import { assertTicketTransition } from "../../domain/tickets/ticketWorkflow";
import { getEffectiveTaxRate } from "../../config/businessProfile";
import { validateFinalMileage, validateTicketLines } from "../../domain/tickets/ticketValidation";
import { createPayment, refreshTicketPaymentStatus } from "./paymentsRepo";
import { createServiceHistory, getServiceHistoryByTicket } from "./serviceHistoryRepo";
import { updateVehicleAfterService } from "./vehiclesRepo";
import { enqueueCompletedTicketLoyaltyEvents } from "../../domain/loyalty/loyaltyCompletionService";
import { backfillMissingInvoiceNumbers, ensureTicketInvoiceNumber, generateInvoiceNumber } from "../../domain/invoices/invoiceNumber";
import { redeemAppliedCoupons } from "./couponsRepo";
import { redeemFreeOilChange } from "./punchCardsRepo";
import { writeAuditLog } from "./auditLogRepo";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { getWorkOrderColumn } from "../../domain/tickets/workOrderStatus";
import type { PaymentMethod } from "../../../types/payment";
import type { TicketPackageDetails, TicketPackageDetailsInput } from "../../../types/servicePackage";
import type { Payment } from "../../../types/payment";
import type { Ticket, TicketItem, TicketLineInput, TicketStatus, TicketWithDetails } from "../../../types/ticket";

export interface DashboardMetrics {
  todaySales: number;
  netSales: number;
  carCount: number;
  averageTicket: number;
  openTickets: number;
  lowInventory: number;
  vehicleCountToday: number;
  unpaidCompleted: number;
  waitingPayment: number;
  inService: number;
  completedToday: number;
  partialPaid: number;
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

export interface FinalizeTicketInput {
  finalMileage: number;
  oilType: string | null;
  managerOverrideUnpaid?: boolean;
}

export interface TicketFilters {
  statuses?: TicketStatus[];
  includeCompletedTodayOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface WorkOrderTicketSummary {
  ticketId: string;
  invoiceNumber: string | null;
  status: TicketStatus;
  paymentStatus: string;
  customerName: string;
  vehicleLabel: string;
  plate: string | null;
  mileage: number | null;
  mainService: string | null;
  total: number;
  paid: number;
  amountDue: number;
  bay: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface WorkOrdersForDate {
  open: WorkOrderTicketSummary[];
  inBay: WorkOrderTicketSummary[];
  serviceComplete: WorkOrderTicketSummary[];
  finalized: WorkOrderTicketSummary[];
}

function mapTicketRows(rows: TicketWithDetails[], items: TicketItem[]): TicketWithDetails[] {
  return rows.map((ticket) => ({
    ...ticket,
    invoice_number: ticket.invoice_number ?? (ticket.external_source === "droptop" && ticket.external_id ? ticket.external_id : null),
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
  const lineError = validateTicketLines(input.items);
  if (lineError) throw new Error(lineError);

  const id = createId("tkt");
  const employee = getCurrentEmployeeSnapshot();
  const timestamp = nowIso();
  const invoiceNumber = await generateInvoiceNumber(timestamp);
  const totals = calculateTicketTotals(input.items, [], { taxRate: input.taxRate });

  await execute(
    `INSERT INTO tickets (
      id, invoice_number, customer_id, vehicle_id, status, subtotal, discount_total, taxable_subtotal, tax_rate, tax_total, fee_total,
      total, amount_due, payment_status, notes, customer_concern, technician_notes, internal_notes,
      created_at, updated_at, completed_at, deleted_at, sync_status, created_by_employee_id
    ) VALUES (?, ?, ?, ?, 'checked_in', ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', NULL, ?, ?, ?, ?, ?, NULL, NULL, 'pending', ?)`,
    [
      id,
      invoiceNumber,
      input.customer_id,
      input.vehicle_id,
      totals.subtotal,
      totals.discountTotal,
      totals.taxableSubtotal,
      totals.taxRate,
      totals.taxTotal,
      totals.feeTotal,
      totals.total,
      totals.amountDue,
      input.customer_concern,
      input.technician_notes,
      input.internal_notes,
      timestamp,
      timestamp,
      employee.id
    ]
  );

  for (const item of input.items) {
    await execute(
      `INSERT INTO ticket_items (
        id, ticket_id, service_id, item_type, package_id, inventory_item_id,
        cost, sku, product_id, source_price_type, name, quantity, unit_price, line_total, taxable,
        created_at, updated_at, deleted_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
      [
        createId("item"),
        id,
        item.service_id,
        item.item_type ?? (item.service_id ? "service" : "custom"),
        item.package_id ?? null,
        item.inventory_item_id ?? null,
        item.cost ?? null,
        item.sku ?? null,
        item.product_id ?? null,
        item.source_price_type ?? null,
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
        filter_type, cartridge_filter_extra_fee, oil_filter_inventory_item_id,
        oil_filter_sku, oil_filter_name, oil_filter_source, oil_inventory_item_id,
        oil_sku, oil_name, oil_source, package_base_price, package_total,
        created_at, updated_at, deleted_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
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
        input.packageDetails.oil_filter_inventory_item_id ?? null,
        input.packageDetails.oil_filter_sku ?? null,
        input.packageDetails.oil_filter_name ?? null,
        input.packageDetails.oil_filter_source ?? null,
        input.packageDetails.oil_inventory_item_id ?? null,
        input.packageDetails.oil_sku ?? null,
        input.packageDetails.oil_name ?? null,
        input.packageDetails.oil_source ?? null,
        input.packageDetails.package_base_price,
        input.packageDetails.package_total,
        timestamp,
        timestamp
      ]
    );
  }

  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket was not created.");
  await writeAuditLog({ action: "ticket.created", entity_type: "ticket", entity_id: id, summary: `Created ticket ${id}`, after: ticket });
  return ticket;
}

export async function createOrUpdateServiceTicket(input: CreateTicketInput & { ticket_id?: string | null }): Promise<TicketWithDetails> {
  if (input.ticket_id) {
    const existing = await getTicketById(input.ticket_id);
    if (existing) return existing;
  }
  return createTicketWithItems(input);
}

export async function listTicketsWithDetails(filters: TicketFilters = {}): Promise<TicketWithDetails[]> {
  await backfillMissingInvoiceNumbers();
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
  await backfillMissingInvoiceNumbers();
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
  await backfillMissingInvoiceNumbers();
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

export async function getWorkOrdersForDate(date: string): Promise<WorkOrdersForDate> {
  await backfillMissingInvoiceNumbers();
  const rows = await query<TicketWithDetails & { paid: number; amount_due: number }>(
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
      (SELECT GROUP_CONCAT(name, ', ') FROM ticket_items WHERE ticket_id = t.id AND deleted_at IS NULL) AS service_names,
      COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ticket_id = t.id AND p.deleted_at IS NULL AND p.status = 'paid'), 0) AS paid,
      MAX(t.total - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.ticket_id = t.id AND p.deleted_at IS NULL AND p.status = 'paid'), 0), 0) AS amount_due
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.deleted_at IS NULL
       AND t.status != 'canceled'
       AND (
        (t.status IN ('open', 'draft', 'checked_in', 'in_line', 'in_service', 'waiting_payment') AND (t.completed_at IS NULL OR t.created_at LIKE ? OR t.updated_at LIKE ?))
        OR (t.status IN ('completed', 'finalized') AND COALESCE(t.completed_at, t.updated_at, t.created_at) LIKE ?)
       )
     ORDER BY
       CASE t.status
        WHEN 'draft' THEN 0
        WHEN 'checked_in' THEN 1
        WHEN 'in_service' THEN 2
        WHEN 'waiting_payment' THEN 3
        WHEN 'completed' THEN 4
        ELSE 5
       END,
       COALESCE(t.completed_at, t.updated_at, t.created_at) ASC`,
    [`${date}%`, `${date}%`, `${date}%`]
  );

  const summaries = rows.map((ticket): WorkOrderTicketSummary => {
    const customerName = [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in Customer";
    const vehicleLabel = [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle not set";
    const plate = [ticket.vehicle_plate, ticket.vehicle_plate_state].filter(Boolean).join(" ") || null;
    const invoiceNumber = ticket.invoice_number ?? (ticket.external_source === "droptop" && ticket.external_id ? ticket.external_id : null);
    return {
      ticketId: ticket.id,
      invoiceNumber,
      status: ticket.status,
      paymentStatus: ticket.payment_status,
      customerName,
      vehicleLabel,
      plate,
      mileage: ticket.vehicle_mileage,
      mainService: ticket.service_names?.split(",").map((name) => name.trim()).filter(Boolean)[0] ?? null,
      total: Number(ticket.total) || 0,
      paid: Number(ticket.paid) || 0,
      amountDue: Math.max(Number(ticket.amount_due) || 0, 0),
      bay: ticket.bay,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      completedAt: ticket.completed_at
    };
  });

  const grouped: WorkOrdersForDate = { open: [], inBay: [], serviceComplete: [], finalized: [] };
  summaries.forEach((ticket) => {
    grouped[getWorkOrderColumn(ticket)].push(ticket);
  });
  return grouped;
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
  const invoiceNumber = await ensureTicketInvoiceNumber(ticket);
  const items = await loadItems([id]);
  const packageDetails = await loadPackageDetails(id);
  return { ...ticket, invoice_number: invoiceNumber, items, packageDetails };
}

export async function getLastCompletedTicketPackageDetailsByVehicle(vehicleId: string): Promise<TicketPackageDetails | null> {
  const rows = await query<TicketPackageDetails>(
    `SELECT tpd.*
     FROM ticket_package_details tpd
     JOIN tickets t ON t.id = tpd.ticket_id
     WHERE t.vehicle_id = ?
       AND t.status = 'completed'
       AND t.deleted_at IS NULL
       AND tpd.deleted_at IS NULL
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC
     LIMIT 1`,
    [vehicleId]
  );
  return rows[0] ?? null;
}

export async function getLastCompletedTicketItemsByVehicle(vehicleId: string): Promise<TicketItem[]> {
  return query<TicketItem>(
    `SELECT ti.*
     FROM ticket_items ti
     JOIN tickets t ON t.id = ti.ticket_id
     WHERE t.vehicle_id = ?
       AND t.status = 'completed'
       AND t.deleted_at IS NULL
       AND ti.deleted_at IS NULL
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC, ti.created_at DESC
     LIMIT 30`,
    [vehicleId]
  );
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, status);
  await execute("UPDATE tickets SET status = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL", [status, nowIso(), id]);
  await writeAuditLog({ action: "ticket.status_changed", entity_type: "ticket", entity_id: id, summary: `Ticket moved from ${ticket.status} to ${status}`, before: ticket, after: { ...ticket, status } });
}

export async function updateTicketBay(id: string, bay: string | null): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  await execute("UPDATE tickets SET bay = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL", [bay, nowIso(), id]);
  await writeAuditLog({ action: "ticket.bay_changed", entity_type: "ticket", entity_id: id, summary: `Ticket moved to ${bay ?? "no bay"}`, before: ticket, after: { ...ticket, bay } });
}

export async function sendTicketToBay(id: string, bay: "Bay 1" | "Bay 2"): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed") throw new Error("Cannot send completed ticket to bay.");
  if (ticket.status === "canceled") throw new Error("Cannot send canceled ticket to bay.");
  if (bay !== "Bay 1" && bay !== "Bay 2") throw new Error("Select Bay 1 or Bay 2.");

  const [occupied] = await query<Pick<Ticket, "id" | "invoice_number">>(
    "SELECT id, invoice_number FROM tickets WHERE status = 'in_service' AND bay = ? AND id <> ? AND deleted_at IS NULL LIMIT 1",
    [bay, id]
  );
  if (occupied) throw new Error(`${bay} is already occupied.`);

  const timestamp = nowIso();
  const employee = getCurrentEmployeeSnapshot();
  await execute(
    "UPDATE tickets SET status = 'in_service', bay = ?, started_at = COALESCE(started_at, ?), started_by_employee_id = COALESCE(started_by_employee_id, ?), updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL",
    [bay, timestamp, employee.id, timestamp, id]
  );

  const summary = ticket.status === "waiting_payment"
    ? `Sent back to ${bay}`
    : ticket.bay && ticket.bay !== bay
      ? `Moved from ${ticket.bay} to ${bay}`
      : `Sent to ${bay}`;

  await writeAuditLog({
    action: ticket.bay && ticket.bay !== bay ? "ticket.bay_moved" : ticket.status === "waiting_payment" ? "ticket.sent_back_to_bay" : "ticket.sent_to_bay",
    entity_type: "ticket",
    entity_id: id,
    summary,
    before: ticket,
    after: { ...ticket, status: "in_service", bay }
  });
}

export async function moveTicketBay(id: string, bay: string): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status !== "in_service") throw new Error("Only in-service tickets can move bays.");
  await updateTicketBay(id, bay);
}

export async function markWaitingPayment(id: string): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, "waiting_payment");
  await updateTicketStatus(id, "waiting_payment");
}

export async function updateTicketPaymentStatus(ticketId: string): Promise<void> {
  await refreshTicketPaymentStatus(ticketId);
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

async function recalculateTicketTotals(ticketId: string, taxRate?: number): Promise<void> {
  if (taxRate === undefined) {
    taxRate = await getEffectiveTaxRate();
  }
  const items = await loadItems([ticketId]);
  const payments = await query<Payment>(
    "SELECT amount, status FROM payments WHERE ticket_id = ? AND deleted_at IS NULL",
    [ticketId]
  );
  const totals = calculateTicketTotals(
    items.map((item) => ({
      service_id: item.service_id,
      item_type: item.item_type as TicketLineInput["item_type"],
      package_id: item.package_id,
      inventory_item_id: item.inventory_item_id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      taxable: item.taxable
    })),
    payments,
    { taxRate }
  );
  await execute(
    "UPDATE tickets SET subtotal = ?, discount_total = ?, taxable_subtotal = ?, tax_rate = ?, tax_total = ?, fee_total = ?, total = ?, amount_due = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [totals.subtotal, totals.discountTotal, totals.taxableSubtotal, totals.taxRate, totals.taxTotal, totals.feeTotal, totals.total, totals.amountDue, nowIso(), ticketId]
  );
}

export async function ensureTicketTotals(ticketId: string): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed" || ticket.status === "canceled") return;
  if (
    ticket.tax_total === undefined ||
    ticket.tax_rate === undefined ||
    ticket.taxable_subtotal === undefined ||
    ticket.amount_due === undefined
  ) {
    await recalculateTicketTotals(ticketId);
  }
}

export async function addTicketItem(ticketId: string, item: TicketLineInput, taxRate = 0): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed" || ticket.status === "canceled") throw new Error("Completed and canceled tickets are locked.");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO ticket_items (
      id, ticket_id, service_id, item_type, package_id, inventory_item_id, name,
      cost, sku, product_id, source_price_type, quantity, unit_price, line_total, taxable, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      createId("item"),
      ticketId,
      item.service_id,
      item.item_type ?? "custom",
      item.package_id ?? null,
      item.inventory_item_id ?? null,
      item.name,
      item.cost ?? null,
      item.sku ?? null,
      item.product_id ?? null,
      item.source_price_type ?? null,
      item.quantity,
      item.unit_price,
      Math.round(item.quantity * item.unit_price * 100) / 100,
      item.taxable,
      timestamp,
      timestamp
    ]
  );
  await recalculateTicketTotals(ticketId, taxRate);
  await writeAuditLog({ action: "ticket.item_added", entity_type: "ticket", entity_id: ticketId, summary: `Added item ${item.name}`, after: item });
}

export async function updateTicketItem(ticketId: string, itemId: string, item: Partial<TicketLineInput>, taxRate = 0): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed" || ticket.status === "canceled") throw new Error("Completed and canceled tickets are locked.");
  const rows = await query<TicketItem>("SELECT * FROM ticket_items WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL", [itemId, ticketId]);
  const current = rows[0];
  if (!current) throw new Error("Line item not found.");
  const next = {
    service_id: item.service_id ?? current.service_id,
    item_type: item.item_type ?? (current.item_type as TicketLineInput["item_type"]),
    package_id: item.package_id ?? current.package_id,
    inventory_item_id: item.inventory_item_id ?? current.inventory_item_id,
    cost: item.cost ?? current.cost ?? null,
    sku: item.sku ?? current.sku ?? null,
    product_id: item.product_id ?? current.product_id ?? null,
    source_price_type: item.source_price_type ?? current.source_price_type ?? null,
    name: item.name ?? current.name,
    quantity: item.quantity ?? current.quantity,
    unit_price: item.unit_price ?? current.unit_price,
    taxable: item.taxable ?? current.taxable
  };
  await execute(
    `UPDATE ticket_items
     SET service_id = ?, item_type = ?, package_id = ?, inventory_item_id = ?,
         cost = ?, sku = ?, product_id = ?, source_price_type = ?, name = ?,
         quantity = ?, unit_price = ?, line_total = ?, taxable = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL`,
    [
      next.service_id,
      next.item_type ?? "custom",
      next.package_id,
      next.inventory_item_id,
      next.cost,
      next.sku,
      next.product_id,
      next.source_price_type,
      next.name,
      next.quantity,
      next.unit_price,
      Math.round(next.quantity * next.unit_price * 100) / 100,
      next.taxable,
      nowIso(),
      itemId,
      ticketId
    ]
  );
  await recalculateTicketTotals(ticketId, taxRate);
  await writeAuditLog({ action: "ticket.item_edited", entity_type: "ticket", entity_id: ticketId, summary: `Edited item ${next.name}`, before: current, after: next });
}

export async function updateTicketItemQuantity(ticketId: string, itemId: string, quantity: number, taxRate = 0): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed" || ticket.status === "canceled") throw new Error("Completed and canceled tickets are locked.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be greater than zero.");
  const rows = await query<TicketItem>("SELECT * FROM ticket_items WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL", [itemId, ticketId]);
  const current = rows[0];
  if (!current) throw new Error("Line item not found.");
  if (current.item_type === "package" || current.item_type === "discount") throw new Error("This line item quantity cannot be edited inline.");
  const roundedQuantity = Math.round(quantity * 1000) / 1000;
  await execute(
    "UPDATE ticket_items SET quantity = ?, line_total = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND ticket_id = ? AND deleted_at IS NULL",
    [roundedQuantity, Math.round(roundedQuantity * current.unit_price * 100) / 100, nowIso(), itemId, ticketId]
  );
  await recalculateTicketTotals(ticketId, taxRate);
  await writeAuditLog({
    action: "ticket.item_quantity_changed",
    entity_type: "ticket",
    entity_id: ticketId,
    summary: `Line item quantity changed from ${current.quantity} to ${roundedQuantity}`,
    before: { itemId, quantity: current.quantity },
    after: { itemId, quantity: roundedQuantity }
  });
}

export async function removeTicketItem(ticketId: string, itemId: string, taxRate = 0): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "completed" || ticket.status === "canceled") throw new Error("Completed and canceled tickets are locked.");
  await execute("UPDATE ticket_items SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND ticket_id = ?", [nowIso(), nowIso(), itemId, ticketId]);
  await recalculateTicketTotals(ticketId, taxRate);
  await writeAuditLog({ action: "ticket.item_removed", entity_type: "ticket", entity_id: ticketId, summary: `Removed ticket item ${itemId}`, metadata: { itemId } });
}

export async function completeTicket(id: string, input: CompleteTicketInput): Promise<void> {
  if (!input.paymentMethod) throw new Error("Payment method is required.");
  if (input.paymentAmount !== undefined && (!Number.isFinite(input.paymentAmount) || input.paymentAmount <= 0)) throw new Error("Payment amount is required.");
  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, "completed");
  if (ticket.completed_at) throw new Error("Ticket is already completed.");
  if (!ticket.vehicle_id) throw new Error("Ticket has no vehicle.");
  if (!ticket.customer_id) throw new Error("Ticket has no customer.");
  const mileageError = validateFinalMileage(ticket.vehicle_mileage, input.finalMileage);
  if (mileageError) throw new Error(mileageError);
  const timestamp = nowIso();
  const paymentAmount = input.paymentAmount ?? ticket.total;
  const paymentStatus = paymentAmount >= ticket.total ? "paid" : "partial";

  await createPayment({
    ticket_id: id,
    method: input.paymentMethod,
    amount: paymentAmount,
    status: paymentStatus === "paid" ? "paid" : "partial",
    reference: input.reference ?? null,
    paid_at: timestamp
  });
  const completedOilType = input.oilType ?? ticket.packageDetails?.oil_type ?? null;
  await updateVehicleAfterService(ticket.vehicle_id, input.finalMileage, completedOilType, {
    oil_capacity: ticket.packageDetails?.actual_quarts ?? null,
    oil_filter_sku: ticket.packageDetails?.oil_filter_sku ?? null,
    oil_filter_inventory_item_id: ticket.packageDetails?.oil_filter_inventory_item_id ?? null
  });
  await execute(
    "UPDATE tickets SET status = 'completed', payment_status = ?, completed_at = ?, bay = NULL, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [paymentStatus, timestamp, timestamp, id]
  );
  const serviceHistory = await createServiceHistory({
    ticket_id: id,
    customer_id: ticket.customer_id,
    vehicle_id: ticket.vehicle_id,
    service_date: timestamp,
    mileage: input.finalMileage,
    oil_type: completedOilType,
    services_json: JSON.stringify({
      items: ticket.items.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total, inventory_item_id: item.inventory_item_id })),
      packageDetails: ticket.packageDetails ?? null
    }),
    notes: [ticket.customer_concern, ticket.technician_notes, ticket.internal_notes].filter(Boolean).join(" | ") || null
  });
  const redeemedCoupons = await redeemAppliedCoupons(id);
  if (redeemedCoupons.some((coupon) => coupon.discount_type === "free_oil_change")) {
    await redeemFreeOilChange(id, ticket.customer_id, ticket.vehicle_id).catch((error: unknown) => {
      console.warn("[free-oil-change-redemption]", error);
    });
  }
  enqueueCompletedTicketLoyaltyEvents({ ...ticket, status: "completed", payment_status: paymentStatus }, serviceHistory).catch((error: unknown) => {
    console.warn("[loyalty-sync-queue]", error);
  });
}

export async function finalizeTicket(id: string, input: FinalizeTicketInput): Promise<void> {
  const ticket = await getTicketById(id);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, "completed");
  if (ticket.completed_at) throw new Error("Ticket is already completed.");
  if (!ticket.vehicle_id) throw new Error("Ticket has no vehicle.");
  if (!ticket.customer_id) throw new Error("Ticket has no customer.");
  const summary = await refreshTicketPaymentStatus(id);
  if (summary.paymentStatus !== "paid" && !input.managerOverrideUnpaid) {
    throw new Error("Ticket must be paid before finalizing.");
  }
  const mileageError = validateFinalMileage(ticket.vehicle_mileage, input.finalMileage);
  if (mileageError) throw new Error(mileageError);
  const timestamp = nowIso();
  const completedOilType = input.oilType ?? ticket.packageDetails?.oil_type ?? null;

  await updateVehicleAfterService(ticket.vehicle_id, input.finalMileage, completedOilType, {
    oil_capacity: ticket.packageDetails?.actual_quarts ?? null,
    oil_filter_sku: ticket.packageDetails?.oil_filter_sku ?? null,
    oil_filter_inventory_item_id: ticket.packageDetails?.oil_filter_inventory_item_id ?? null
  });
  await execute(
    "UPDATE tickets SET status = 'completed', payment_status = ?, completed_at = ?, bay = NULL, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [summary.paymentStatus === "paid" ? "paid" : "partially_paid", timestamp, timestamp, id]
  );
  let serviceHistory = await getServiceHistoryByTicket(id);
  if (!serviceHistory) {
    serviceHistory = await createServiceHistory({
      ticket_id: id,
      customer_id: ticket.customer_id,
      vehicle_id: ticket.vehicle_id,
      service_date: timestamp,
      mileage: input.finalMileage,
      oil_type: completedOilType,
      services_json: JSON.stringify({
        items: ticket.items.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total, inventory_item_id: item.inventory_item_id })),
        packageDetails: ticket.packageDetails ?? null
      }),
      notes: [ticket.customer_concern, ticket.technician_notes, ticket.internal_notes].filter(Boolean).join(" | ") || null
    });
  }
  const redeemedCoupons = await redeemAppliedCoupons(id);
  if (redeemedCoupons.some((coupon) => coupon.discount_type === "free_oil_change")) {
    await redeemFreeOilChange(id, ticket.customer_id, ticket.vehicle_id).catch((error: unknown) => {
      console.warn("[free-oil-change-redemption]", error);
    });
  }
  enqueueCompletedTicketLoyaltyEvents({ ...ticket, status: "completed", payment_status: summary.paymentStatus === "paid" ? "paid" : "partially_paid" }, serviceHistory).catch((error: unknown) => {
    console.warn("[loyalty-sync-queue]", error);
  });
  await writeAuditLog({ action: "ticket.finalized", entity_type: "ticket", entity_id: id, summary: `Finalized ticket ${id}`, after: { finalMileage: input.finalMileage, oilType: completedOilType } });
}

export async function startService(ticketId: string, bay: string): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, "in_service");
  const employee = getCurrentEmployeeSnapshot();
  await execute(
    "UPDATE tickets SET status = 'in_service', bay = ?, started_at = COALESCE(started_at, ?), started_by_employee_id = COALESCE(started_by_employee_id, ?), updated_at = ?, sync_status = 'pending' WHERE id = ? AND deleted_at IS NULL",
    [bay, nowIso(), employee.id, nowIso(), ticketId]
  );
  await writeAuditLog({ action: "ticket.service_started", entity_type: "ticket", entity_id: ticketId, summary: `Service started in ${bay}`, before: ticket, after: { ...ticket, status: "in_service", bay } });
}

export async function cancelTicket(id: string): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, "canceled");
  const timestamp = nowIso();
  await execute("UPDATE ticket_coupon_applications SET status = 'canceled', removed_at = ?, updated_at = ?, sync_status = 'pending' WHERE ticket_id = ? AND status = 'applied'", [timestamp, timestamp, id]);
  await execute("UPDATE ticket_items SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE ticket_id = ? AND source_price_type = 'coupon' AND deleted_at IS NULL", [timestamp, timestamp, id]);
  await execute("UPDATE tickets SET free_oil_change_redeemed = 0, applied_coupon_ids = NULL WHERE id = ?", [id]);
  await updateTicketStatus(id, "canceled");
  await writeAuditLog({ action: "ticket.canceled", entity_type: "ticket", entity_id: id, summary: `Canceled ticket ${id}` });
}

export async function reopenTicket(id: string): Promise<void> {
  const ticket = await getTicket(id);
  if (!ticket) throw new Error("Ticket not found.");
  assertTicketTransition(ticket.status, "checked_in");
  await updateTicketStatus(id, "checked_in");
}

export async function getDashboardMetrics(range: { dateFrom?: string; dateTo?: string } = {}): Promise<DashboardMetrics> {
  const today = `${todayIsoDate()}%`;
  const params: unknown[] = [];
  const dateClauses = ["deleted_at IS NULL", "status = 'completed'"];
  if (range.dateFrom) {
    dateClauses.push("completed_at >= ?");
    params.push(range.dateFrom);
  } else {
    dateClauses.push("completed_at LIKE ?");
    params.push(today);
  }
  if (range.dateTo) {
    dateClauses.push("completed_at <= ?");
    params.push(range.dateTo);
  }
  const [sales] = await query<{ total: number | null; count: number }>(
    `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM tickets WHERE ${dateClauses.join(" AND ")}`,
    params
  );
  const [net] = await query<{ total: number | null }>(
    `SELECT COALESCE(SUM(total - tax_total), 0) as total FROM tickets WHERE ${dateClauses.join(" AND ")}`,
    params
  );
  const [open] = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM tickets WHERE status IN ('checked_in', 'in_service', 'waiting_payment') AND deleted_at IS NULL"
  );
  const [unpaidCompleted] = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM tickets WHERE status = 'completed' AND payment_status != 'paid' AND deleted_at IS NULL ${range.dateFrom ? "AND completed_at >= ?" : "AND completed_at LIKE ?"} ${range.dateTo ? "AND completed_at <= ?" : ""}`,
    range.dateFrom ? (range.dateTo ? [range.dateFrom, range.dateTo] : [range.dateFrom]) : [today]
  );
  const [partialPaid] = await query<{ count: number }>("SELECT COUNT(*) as count FROM tickets WHERE payment_status IN ('partial', 'partially_paid') AND deleted_at IS NULL");
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
    netSales: net?.total ?? 0,
    carCount,
    averageTicket: carCount > 0 ? todaySales / carCount : 0,
    openTickets: open?.count ?? 0,
    lowInventory: lowInventory?.count ?? 0,
    vehicleCountToday: carCount,
    unpaidCompleted: unpaidCompleted?.count ?? 0,
    waitingPayment: waitingPayment?.count ?? 0,
    inService: inService?.count ?? 0,
    completedToday: carCount,
    partialPaid: partialPaid?.count ?? 0
  };
}

export const getTodayDashboardMetrics = getDashboardMetrics;
