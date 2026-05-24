import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { Payment, PaymentMethod } from "../../../types/payment";

export interface PaymentInput {
  ticket_id: string;
  amount: number;
  method: PaymentMethod;
  status?: string;
  reference?: string | null;
  paid_at?: string;
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

export async function createPayment(input: PaymentInput): Promise<Payment> {
  const id = createId("pay");
  const timestamp = nowIso();
  const paidAt = input.paid_at ?? timestamp;
  await execute(
    `INSERT INTO payments (
      id, ticket_id, amount, method, status, reference, paid_at,
      created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.ticket_id, input.amount, input.method, input.status ?? "paid", input.reference ?? null, paidAt, timestamp, timestamp]
  );
  const rows = await query<Payment>("SELECT * FROM payments WHERE id = ?", [id]);
  const payment = rows[0];
  if (!payment) throw new Error("Payment was not created.");
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
