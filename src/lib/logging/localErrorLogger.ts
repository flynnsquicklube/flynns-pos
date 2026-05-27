import { execute, query } from "../db/sqlite";
import { createId } from "../utils/ids";
import { nowIso } from "../utils/dates";

export interface LocalErrorEntry {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context_json: string | null;
  created_at: string;
  resolved_at: string | null;
}

export async function logLocalError(source: string, error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const parsed = error instanceof Error ? error : new Error(String(error));
    await execute(
      `INSERT INTO local_errors (id, source, message, stack, context_json, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [createId("err"), source, parsed.message, parsed.stack ?? null, context ? JSON.stringify(context) : null, nowIso()]
    );
  } catch (loggingError) {
    console.warn("Unable to write local error log", loggingError);
  }
}

export async function listLocalErrors(limit = 12, includeResolved = false): Promise<LocalErrorEntry[]> {
  return query<LocalErrorEntry>(
    `SELECT * FROM local_errors ${includeResolved ? "" : "WHERE resolved_at IS NULL"} ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

export async function markLocalErrorResolved(id: string): Promise<void> {
  await execute("UPDATE local_errors SET resolved_at = ? WHERE id = ?", [nowIso(), id]);
}

export async function clearResolvedLocalErrors(): Promise<void> {
  await execute("DELETE FROM local_errors WHERE resolved_at IS NOT NULL");
}
