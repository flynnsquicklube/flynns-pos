import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { PrintDocumentType, PrintJob, PrintJobStatus, PrintMode } from "../../printing/printTypes";

export interface CreatePrintJobInput {
  ticket_id?: string | null;
  document_type: PrintDocumentType;
  print_mode: PrintMode;
  printer_model?: string | null;
  printer_language?: string | null;
  template_id?: string | null;
  payload_json: string;
  rendered_html?: string | null;
  raw_command?: string | null;
  created_by?: string | null;
}

export async function createPrintJob(input: CreatePrintJobInput): Promise<PrintJob> {
  const id = createId("print");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO print_jobs (
      id, ticket_id, document_type, status, print_mode, printer_model, printer_language,
      template_id, payload_json, rendered_html, raw_command, error_message,
      created_at, updated_at, printed_at, created_by
    ) VALUES (?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?)`,
    [
      id,
      input.ticket_id ?? null,
      input.document_type,
      input.print_mode,
      input.printer_model ?? null,
      input.printer_language ?? null,
      input.template_id ?? null,
      input.payload_json,
      input.rendered_html ?? null,
      input.raw_command ?? null,
      timestamp,
      timestamp,
      input.created_by ?? null
    ]
  );
  const job = await getPrintJobById(id);
  if (!job) throw new Error("Print job was not created.");
  return job;
}

export async function updatePrintJobStatus(id: string, status: PrintJobStatus, error?: string | null): Promise<void> {
  const timestamp = nowIso();
  await execute(
    `UPDATE print_jobs
     SET status = ?,
         error_message = ?,
         printed_at = CASE WHEN ? = 'printed' THEN ? ELSE printed_at END,
         updated_at = ?
     WHERE id = ?`,
    [status, error ?? null, status, timestamp, timestamp, id]
  );
}

export async function markPrinted(id: string): Promise<void> {
  await updatePrintJobStatus(id, "printed", null);
}

export async function markFailed(id: string, error: string): Promise<void> {
  await updatePrintJobStatus(id, "failed", error);
}

export async function getPrintJobById(id: string): Promise<PrintJob | null> {
  const rows = await query<PrintJob>("SELECT * FROM print_jobs WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function listPrintJobsByTicket(ticketId: string): Promise<PrintJob[]> {
  return query<PrintJob>("SELECT * FROM print_jobs WHERE ticket_id = ? ORDER BY created_at DESC", [ticketId]);
}

export async function listRecentPrintJobs(limit = 50): Promise<PrintJob[]> {
  return query<PrintJob>("SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT ?", [limit]);
}
