import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { writeAuditLog } from "./auditLogRepo";
import type { Payment, PaymentMethod } from "../../../types/payment";

export interface PaymentInput {
  ticket_id: string;
  amount: number;
  method: PaymentMethod;
  payment_subtype?: string | null;
  status?: string;
  reference?: string | null;
  memo?: string | null;
  paid_at?: string;
  external_source?: string | null;
  external_id?: string | null;
  is_imported?: number;
}

export interface PaymentFilters {
  ticketId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaymentWithTicket extends Payment {
  customer_first_name: string | null;
  customer_last_name: string | null;
  ticket_total: number;
}

export interface TicketPaymentSummary {
  ticketId: string;
  total: number;
  paid: number;
  balanceDue: number;
  paymentStatus: "unpaid" | "partially_paid" | "paid";
}

function normalizePaymentStatus(total: number, paid: number): "unpaid" | "partially_paid" | "paid" {
  if (paid <= 0) return "unpaid";
  if (paid + 0.00001 >= total) return "paid";
  return "partially_paid";
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  const id = createId("pay");
  const timestamp = nowIso();
  const paidAt = input.paid_at ?? timestamp;
  const employee = getCurrentEmployeeSnapshot();
  await execute(
    `INSERT INTO payments (
      id, ticket_id, amount, method, payment_subtype, status, reference, paid_at,
      memo, external_source, external_id, is_imported, employee_id, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      id,
      input.ticket_id,
      input.amount,
      input.method,
      input.payment_subtype ?? null,
      input.status ?? "paid",
      input.reference ?? null,
      paidAt,
      input.memo ?? null,
      input.external_source ?? null,
      input.external_id ?? null,
      input.is_imported ?? 0,
      employee.id,
      timestamp,
      timestamp
    ]
  );
  const rows = await query<Payment>("SELECT * FROM payments WHERE id = ?", [id]);
  const payment = rows[0];
  if (!payment) throw new Error("Payment was not created.");
  await writeAuditLog({ action: "payment.added", entity_type: "payment", entity_id: id, summary: `Added ${input.method} payment`, after: payment });
  return payment;
}

export async function listPayments(filters: PaymentFilters = {}): Promise<PaymentWithTicket[]> {
  const clauses = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.ticketId) {
    clauses.push("p.ticket_id = ?");
    params.push(filters.ticketId);
  }
  if (filters.dateFrom) {
    clauses.push("p.paid_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("p.paid_at <= ?");
    params.push(filters.dateTo);
  }
  return query<PaymentWithTicket>(
    `SELECT
      p.*,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      t.total AS ticket_total
     FROM payments p
     LEFT JOIN tickets t ON t.id = p.ticket_id
     LEFT JOIN customers c ON c.id = t.customer_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY p.paid_at DESC`,
    params
  );
}

export async function getPaymentsByTicket(ticketId: string): Promise<Payment[]> {
  return query<Payment>("SELECT * FROM payments WHERE ticket_id = ? AND deleted_at IS NULL ORDER BY paid_at DESC", [ticketId]);
}

export const listPaymentsByTicket = getPaymentsByTicket;

export async function getTicketPaymentSummary(ticketId: string): Promise<TicketPaymentSummary> {
  const [row] = await query<{ total: number; paid: number }>(
    `SELECT t.total AS total,
      COALESCE(SUM(CASE WHEN p.deleted_at IS NULL AND p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS paid
     FROM tickets t
     LEFT JOIN payments p ON p.ticket_id = t.id
     WHERE t.id = ? AND t.deleted_at IS NULL
     GROUP BY t.id`,
    [ticketId]
  );
  if (!row) throw new Error("Ticket not found.");
  const paid = Math.max(Number(row.paid) || 0, 0);
  const total = Math.max(Number(row.total) || 0, 0);
  return {
    ticketId,
    total,
    paid,
    balanceDue: Math.max(total - paid, 0),
    paymentStatus: normalizePaymentStatus(total, paid)
  };
}

export async function refreshTicketPaymentStatus(ticketId: string): Promise<TicketPaymentSummary> {
  const summary = await getTicketPaymentSummary(ticketId);
  await execute("UPDATE tickets SET payment_status = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [
    summary.paymentStatus,
    nowIso(),
    ticketId
  ]);
  return summary;
}

export async function createPaymentAndRefreshTicket(input: PaymentInput): Promise<{ payment: Payment; summary: TicketPaymentSummary }> {
  const payment = await createPayment(input);
  const summary = await refreshTicketPaymentStatus(input.ticket_id);
  return { payment, summary };
}

export async function getPaymentTotals(range: { dateFrom?: string; dateTo?: string } = {}): Promise<{ method: string; total: number; count: number }[]> {
  const clauses = ["deleted_at IS NULL", "status = 'paid'"];
  const params: unknown[] = [];
  if (range.dateFrom) {
    clauses.push("paid_at >= ?");
    params.push(range.dateFrom);
  }
  if (range.dateTo) {
    clauses.push("paid_at <= ?");
    params.push(range.dateTo);
  }
  return query<{ method: string; total: number; count: number }>(
    `SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM payments
     WHERE ${clauses.join(" AND ")}
     GROUP BY method
     ORDER BY total DESC`,
    params
  );
}
