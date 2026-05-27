import { execute, query } from "../sqlite";
import { calculateQuoteTotals } from "../../domain/quotes/quoteTotals";
import { generateQuoteNumber } from "../../domain/quotes/quoteNumber";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

export type QuoteStatus = "draft" | "saved" | "converted" | "canceled";
export type QuoteItemType = "package" | "inventory" | "labor" | "fee" | "discount" | "custom";

export interface Quote {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_vin: string | null;
  vehicle_plate: string | null;
  vehicle_plate_state: string | null;
  vehicle_mileage: number | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  notes: string | null;
  converted_ticket_id: string | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  deleted_at: string | null;
  sync_status: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  item_type: QuoteItemType;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  taxable: number;
  inventory_item_id: string | null;
  package_id: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

export interface QuoteInput {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_id?: string | null;
  vehicle_id?: string | null;
  vehicle_year?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_vin?: string | null;
  vehicle_plate?: string | null;
  vehicle_plate_state?: string | null;
  vehicle_mileage?: number | null;
  notes?: string | null;
}

export interface QuoteItemInput {
  item_type: QuoteItemType;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  taxable?: number;
  inventory_item_id?: string | null;
  package_id?: string | null;
  metadata_json?: string | null;
}

async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  return query<QuoteItem>("SELECT * FROM quote_items WHERE quote_id = ? AND deleted_at IS NULL ORDER BY created_at ASC", [quoteId]);
}

export async function createQuote(input: QuoteInput = {}): Promise<QuoteWithItems> {
  const id = createId("quote");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO quotes (
      id, quote_number, status, customer_name, customer_phone, customer_email, customer_id, vehicle_id,
      vehicle_year, vehicle_make, vehicle_model, vehicle_vin, vehicle_plate, vehicle_plate_state,
      vehicle_mileage, subtotal, discount_total, tax_total, total, notes, created_at, updated_at, sync_status
    ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, 'pending')`,
    [
      id,
      await generateQuoteNumber(),
      input.customer_name ?? null,
      input.customer_phone ?? null,
      input.customer_email ?? null,
      input.customer_id ?? null,
      input.vehicle_id ?? null,
      input.vehicle_year ?? null,
      input.vehicle_make ?? null,
      input.vehicle_model ?? null,
      input.vehicle_vin ?? null,
      input.vehicle_plate ?? null,
      input.vehicle_plate_state ?? null,
      input.vehicle_mileage ?? null,
      input.notes ?? null,
      timestamp,
      timestamp
    ]
  );
  const quote = await getQuoteById(id);
  if (!quote) throw new Error("Quote was not created.");
  return quote;
}

export async function updateQuote(id: string, input: QuoteInput): Promise<void> {
  const current = await getQuoteById(id);
  if (!current) throw new Error("Quote not found.");
  await execute(
    `UPDATE quotes SET customer_name = ?, customer_phone = ?, customer_email = ?, customer_id = ?, vehicle_id = ?,
      vehicle_year = ?, vehicle_make = ?, vehicle_model = ?, vehicle_vin = ?, vehicle_plate = ?, vehicle_plate_state = ?,
      vehicle_mileage = ?, notes = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [
      input.customer_name ?? current.customer_name,
      input.customer_phone ?? current.customer_phone,
      input.customer_email ?? current.customer_email,
      input.customer_id ?? current.customer_id,
      input.vehicle_id ?? current.vehicle_id,
      input.vehicle_year ?? current.vehicle_year,
      input.vehicle_make ?? current.vehicle_make,
      input.vehicle_model ?? current.vehicle_model,
      input.vehicle_vin ?? current.vehicle_vin,
      input.vehicle_plate ?? current.vehicle_plate,
      input.vehicle_plate_state ?? current.vehicle_plate_state,
      input.vehicle_mileage ?? current.vehicle_mileage,
      input.notes ?? current.notes,
      nowIso(),
      id
    ]
  );
}

export async function getQuoteById(id: string): Promise<QuoteWithItems | null> {
  const rows = await query<Quote>("SELECT * FROM quotes WHERE id = ? AND deleted_at IS NULL", [id]);
  const quote = rows[0];
  if (!quote) return null;
  return { ...quote, items: await getQuoteItems(id) };
}

export async function listQuotes(filters: { status?: QuoteStatus } = {}): Promise<QuoteWithItems[]> {
  const rows = await query<Quote>(
    `SELECT * FROM quotes WHERE deleted_at IS NULL AND (? IS NULL OR status = ?) ORDER BY updated_at DESC`,
    [filters.status ?? null, filters.status ?? null]
  );
  return Promise.all(rows.map(async (quote) => ({ ...quote, items: await getQuoteItems(quote.id) })));
}

export async function recalculateQuoteTotals(quoteId: string, taxRate = 0): Promise<void> {
  const items = await getQuoteItems(quoteId);
  const totals = calculateQuoteTotals(items, taxRate);
  await execute(
    "UPDATE quotes SET subtotal = ?, discount_total = ?, tax_total = ?, total = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [totals.subtotal, totals.discount_total, totals.tax_total, totals.total, nowIso(), quoteId]
  );
}

export async function addQuoteItem(quoteId: string, input: QuoteItemInput, taxRate = 0): Promise<void> {
  const id = createId("qitem");
  const timestamp = nowIso();
  const quantity = Number(input.quantity) || 1;
  const unitPrice = Number(input.unit_price) || 0;
  await execute(
    `INSERT INTO quote_items (
      id, quote_id, item_type, name, description, quantity, unit_price, line_total, taxable,
      inventory_item_id, package_id, metadata_json, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      quoteId,
      input.item_type,
      input.name,
      input.description ?? null,
      quantity,
      unitPrice,
      Math.round(quantity * unitPrice * 100) / 100,
      input.taxable ?? 1,
      input.inventory_item_id ?? null,
      input.package_id ?? null,
      input.metadata_json ?? null,
      timestamp,
      timestamp
    ]
  );
  await recalculateQuoteTotals(quoteId, taxRate);
}

export async function updateQuoteItem(itemId: string, input: Partial<QuoteItemInput>, taxRate = 0): Promise<void> {
  const rows = await query<QuoteItem>("SELECT * FROM quote_items WHERE id = ? AND deleted_at IS NULL", [itemId]);
  const current = rows[0];
  if (!current) throw new Error("Quote item not found.");
  const quantity = input.quantity ?? current.quantity;
  const unitPrice = input.unit_price ?? current.unit_price;
  await execute(
    `UPDATE quote_items SET item_type = ?, name = ?, description = ?, quantity = ?, unit_price = ?, line_total = ?,
      taxable = ?, inventory_item_id = ?, package_id = ?, metadata_json = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ? AND deleted_at IS NULL`,
    [
      input.item_type ?? current.item_type,
      input.name ?? current.name,
      input.description ?? current.description,
      quantity,
      unitPrice,
      Math.round(quantity * unitPrice * 100) / 100,
      input.taxable ?? current.taxable,
      input.inventory_item_id ?? current.inventory_item_id,
      input.package_id ?? current.package_id,
      input.metadata_json ?? current.metadata_json,
      nowIso(),
      itemId
    ]
  );
  await recalculateQuoteTotals(current.quote_id, taxRate);
}

export async function removeQuoteItem(itemId: string, taxRate = 0): Promise<void> {
  const rows = await query<QuoteItem>("SELECT * FROM quote_items WHERE id = ? AND deleted_at IS NULL", [itemId]);
  const current = rows[0];
  if (!current) return;
  await execute("UPDATE quote_items SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), nowIso(), itemId]);
  await recalculateQuoteTotals(current.quote_id, taxRate);
}

export async function saveQuote(quoteId: string): Promise<void> {
  await execute("UPDATE quotes SET status = 'saved', updated_at = ?, sync_status = 'pending' WHERE id = ? AND status != 'converted'", [nowIso(), quoteId]);
}

export async function cancelQuote(quoteId: string): Promise<void> {
  await execute("UPDATE quotes SET status = 'canceled', updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), quoteId]);
}

export async function convertQuoteToTicket(quoteId: string, conversionInput?: { convertedTicketId?: string | null }): Promise<void> {
  await execute(
    "UPDATE quotes SET status = 'converted', converted_ticket_id = ?, converted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [conversionInput?.convertedTicketId ?? null, nowIso(), nowIso(), quoteId]
  );
}
