import type { Ticket } from "../../../types/ticket";
import { execute, query } from "../../db/sqlite";
import { nowIso } from "../../utils/dates";

type InvoiceTicket = Pick<Ticket, "id" | "invoice_number" | "created_at" | "external_source" | "external_id">;

function toDate(value: Date | string = new Date()): Date {
  return value instanceof Date ? value : new Date(value);
}

function stampForDate(value: Date | string = new Date()): string {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function invoicePrefixForDate(value: Date | string = new Date()): string {
  return `FQL-${stampForDate(value)}`;
}

export function getDisplayInvoiceNumber(ticket: Pick<Ticket, "id" | "invoice_number" | "external_source" | "external_id">): string {
  if (ticket.invoice_number?.trim()) return ticket.invoice_number;
  if (ticket.external_source === "droptop" && ticket.external_id?.trim()) return ticket.external_id;
  return ticket.id;
}

export async function generateInvoiceNumber(value: Date | string = new Date()): Promise<string> {
  const prefix = invoicePrefixForDate(value);
  const existing = await query<{ invoice_number: string }>(
    "SELECT invoice_number FROM tickets WHERE invoice_number LIKE ? ORDER BY invoice_number DESC",
    [`${prefix}-%`]
  );
  const maxSequence = existing.reduce((max, row) => {
    const match = row.invoice_number.match(/-(\d+)$/);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  for (let next = maxSequence + 1; next < maxSequence + 10000; next += 1) {
    const candidate = `${prefix}-${String(next).padStart(4, "0")}`;
    const duplicate = await query<{ count: number }>("SELECT COUNT(*) AS count FROM tickets WHERE invoice_number = ?", [candidate]);
    if ((duplicate[0]?.count ?? 0) === 0) return candidate;
  }

  throw new Error("Unable to generate a unique invoice number.");
}

export async function ensureTicketInvoiceNumber(ticket: InvoiceTicket): Promise<string> {
  if (ticket.invoice_number?.trim()) return ticket.invoice_number;
  const invoiceNumber = ticket.external_source === "droptop" && ticket.external_id?.trim()
    ? ticket.external_id
    : await generateInvoiceNumber(ticket.created_at);

  await execute(
    "UPDATE tickets SET invoice_number = ?, updated_at = ? WHERE id = ? AND (invoice_number IS NULL OR invoice_number = '')",
    [invoiceNumber, nowIso(), ticket.id]
  );
  return invoiceNumber;
}

export async function backfillMissingInvoiceNumbers(): Promise<number> {
  const tickets = await query<InvoiceTicket>(
    `SELECT id, invoice_number, created_at, external_source, external_id
     FROM tickets
     WHERE deleted_at IS NULL AND (invoice_number IS NULL OR invoice_number = '')
     ORDER BY created_at ASC`
  );
  let updated = 0;
  for (const ticket of tickets) {
    await ensureTicketInvoiceNumber(ticket);
    updated += 1;
  }
  return updated;
}
