import { execute, query } from "../sqlite";
import { generateOrderDraftNumber } from "../../domain/orderDrafts/orderDraftNumber";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

export type OrderDraftStatus = "draft" | "abandoned" | "converted" | "canceled";

export interface OrderDraft {
  id: string;
  draft_number: string;
  status: OrderDraftStatus;
  source_path: string | null;
  current_step: string;
  selected_customer_id: string | null;
  selected_vehicle_id: string | null;
  pending_vehicle_json: string | null;
  selected_package_id: string | null;
  draft_json: string;
  summary_json: string | null;
  converted_ticket_id: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  converted_at: string | null;
  canceled_at: string | null;
}

export interface OrderDraftInput {
  source_path?: string | null;
  current_step: string;
  selected_customer_id?: string | null;
  selected_vehicle_id?: string | null;
  pending_vehicle_json?: string | null;
  selected_package_id?: string | null;
  draft_json: string;
  summary_json?: string | null;
}

export type OrderDraftUpdate = Partial<OrderDraftInput> & {
  status?: OrderDraftStatus;
  converted_ticket_id?: string | null;
};

export async function createOrderDraft(input: OrderDraftInput): Promise<OrderDraft> {
  const id = createId("draft");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO order_drafts (
      id, draft_number, status, source_path, current_step, selected_customer_id, selected_vehicle_id,
      pending_vehicle_json, selected_package_id, draft_json, summary_json, created_at, updated_at, last_opened_at
    ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      await generateOrderDraftNumber(),
      input.source_path ?? null,
      input.current_step,
      input.selected_customer_id ?? null,
      input.selected_vehicle_id ?? null,
      input.pending_vehicle_json ?? null,
      input.selected_package_id ?? null,
      input.draft_json,
      input.summary_json ?? null,
      timestamp,
      timestamp,
      timestamp
    ]
  );
  const draft = await getOrderDraftById(id);
  if (!draft) throw new Error("Order draft was not created.");
  return draft;
}

export async function updateOrderDraft(id: string, input: OrderDraftUpdate): Promise<OrderDraft | null> {
  const current = await getOrderDraftById(id);
  if (!current || current.status !== "draft") return current;
  const timestamp = nowIso();
  await execute(
    `UPDATE order_drafts SET
      status = ?,
      source_path = ?,
      current_step = ?,
      selected_customer_id = ?,
      selected_vehicle_id = ?,
      pending_vehicle_json = ?,
      selected_package_id = ?,
      draft_json = ?,
      summary_json = ?,
      converted_ticket_id = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      input.status ?? current.status,
      input.source_path !== undefined ? input.source_path : current.source_path,
      input.current_step !== undefined ? input.current_step : current.current_step,
      input.selected_customer_id !== undefined ? input.selected_customer_id : current.selected_customer_id,
      input.selected_vehicle_id !== undefined ? input.selected_vehicle_id : current.selected_vehicle_id,
      input.pending_vehicle_json !== undefined ? input.pending_vehicle_json : current.pending_vehicle_json,
      input.selected_package_id !== undefined ? input.selected_package_id : current.selected_package_id,
      input.draft_json !== undefined ? input.draft_json : current.draft_json,
      input.summary_json !== undefined ? input.summary_json : current.summary_json,
      input.converted_ticket_id !== undefined ? input.converted_ticket_id : current.converted_ticket_id,
      timestamp,
      id
    ]
  );
  return getOrderDraftById(id);
}

export async function getOrderDraftById(id: string): Promise<OrderDraft | null> {
  const [draft] = await query<OrderDraft>("SELECT * FROM order_drafts WHERE id = ?", [id]);
  return draft ?? null;
}

export async function listActiveOrderDrafts(): Promise<OrderDraft[]> {
  return query<OrderDraft>("SELECT * FROM order_drafts WHERE status = 'draft' ORDER BY updated_at DESC", []);
}

export async function listOrderDraftsForDate(date: string): Promise<OrderDraft[]> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  return query<OrderDraft>(
    "SELECT * FROM order_drafts WHERE status = 'draft' AND (updated_at BETWEEN ? AND ? OR created_at BETWEEN ? AND ?) ORDER BY updated_at DESC",
    [start, end, start, end]
  );
}

export async function markDraftConverted(draftId: string, ticketId: string): Promise<void> {
  const timestamp = nowIso();
  await execute("UPDATE order_drafts SET status = 'converted', converted_ticket_id = ?, converted_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'", [ticketId, timestamp, timestamp, draftId]);
}

export async function cancelDraft(draftId: string): Promise<void> {
  const timestamp = nowIso();
  await execute("UPDATE order_drafts SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'", [timestamp, timestamp, draftId]);
}

export async function cleanupOldDrafts(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const result = await execute("UPDATE order_drafts SET status = 'abandoned', updated_at = ? WHERE status = 'draft' AND updated_at < ?", [nowIso(), cutoff.toISOString()]);
  return result.changes;
}

export async function touchDraftOpened(draftId: string): Promise<void> {
  const timestamp = nowIso();
  await execute("UPDATE order_drafts SET last_opened_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'", [timestamp, timestamp, draftId]);
}
