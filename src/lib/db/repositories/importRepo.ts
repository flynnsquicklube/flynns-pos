import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { ImportBatch, ImportErrorInfo, ImportErrorRow, ImportHistoryEntry, ImportStatus, ImportType } from "../../import/importTypes";

export async function createImportBatch(input: { source: string; fileName: string; importType: ImportType; rowsTotal: number }): Promise<string> {
  const id = createId("imp");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO import_batches (
      id, source, file_name, import_type, status, rows_total, rows_imported,
      rows_skipped, rows_failed, summary_json, started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'running', ?, 0, 0, 0, NULL, ?, NULL, ?, ?)`,
    [id, input.source, input.fileName, input.importType, input.rowsTotal, timestamp, timestamp, timestamp]
  );
  return id;
}

export async function finishImportBatch(
  id: string,
  input: { status: ImportStatus; imported: number; skipped: number; failed: number; summary: Record<string, unknown> }
): Promise<void> {
  const timestamp = nowIso();
  await execute(
    `UPDATE import_batches SET
      status = ?, rows_imported = ?, rows_skipped = ?, rows_failed = ?,
      summary_json = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
    [input.status, input.imported, input.skipped, input.failed, JSON.stringify(input.summary), timestamp, timestamp, id]
  );
}

export async function addImportError(batchId: string, error: ImportErrorInfo): Promise<void> {
  await execute(
    "INSERT INTO import_errors (id, batch_id, row_number, message, row_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [createId("impe"), batchId, error.rowNumber, error.message, error.row ? JSON.stringify(error.row) : null, nowIso()]
  );
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  return query<ImportBatch>("SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 25");
}

export async function getImportHistoryEntry(id: string): Promise<ImportHistoryEntry | null> {
  const batches = await query<ImportBatch>("SELECT * FROM import_batches WHERE id = ?", [id]);
  const batch = batches[0];
  if (!batch) return null;
  const errors = await query<ImportErrorRow>("SELECT * FROM import_errors WHERE batch_id = ? ORDER BY created_at ASC", [id]);
  return { ...batch, errors };
}
