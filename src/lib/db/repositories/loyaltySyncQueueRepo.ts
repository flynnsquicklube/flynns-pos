import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { LoyaltySyncQueueEvent, LoyaltySyncQueueInput, LoyaltySyncQueueStats } from "../../integrations/loyalty/loyaltySync.types";

export async function enqueueLoyaltyEvent(input: LoyaltySyncQueueInput): Promise<LoyaltySyncQueueEvent> {
  const id = createId("loyalty");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO loyalty_sync_queue (
      id, event_type, entity_type, entity_id, payload_json, status, attempts,
      last_error, dry_run_result_json, created_at, updated_at, synced_at, next_retry_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?, ?, NULL, NULL)`,
    [id, input.event_type, input.entity_type, input.entity_id, JSON.stringify({ ...input.payload, localEventId: id }), timestamp, timestamp]
  );
  const rows = await query<LoyaltySyncQueueEvent>("SELECT * FROM loyalty_sync_queue WHERE id = ?", [id]);
  const event = rows[0];
  if (!event) throw new Error("Loyalty sync event was not created.");
  return event;
}

export function listPendingEvents(limit = 50): Promise<LoyaltySyncQueueEvent[]> {
  return query<LoyaltySyncQueueEvent>("SELECT * FROM loyalty_sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?", [limit]);
}

export function listFailedEvents(limit = 50): Promise<LoyaltySyncQueueEvent[]> {
  return query<LoyaltySyncQueueEvent>("SELECT * FROM loyalty_sync_queue WHERE status = 'failed' ORDER BY updated_at DESC LIMIT ?", [limit]);
}

export function listRecentSyncEvents(limit = 50): Promise<LoyaltySyncQueueEvent[]> {
  return query<LoyaltySyncQueueEvent>("SELECT * FROM loyalty_sync_queue ORDER BY updated_at DESC LIMIT ?", [limit]);
}

export async function markProcessing(id: string): Promise<void> {
  await execute("UPDATE loyalty_sync_queue SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ?", [nowIso(), id]);
}

export async function markSynced(id: string): Promise<void> {
  const timestamp = nowIso();
  await execute("UPDATE loyalty_sync_queue SET status = 'synced', last_error = NULL, synced_at = ?, updated_at = ? WHERE id = ?", [timestamp, timestamp, id]);
}

export async function markFailed(id: string, error: string): Promise<void> {
  const retry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await execute("UPDATE loyalty_sync_queue SET status = 'failed', last_error = ?, next_retry_at = ?, updated_at = ? WHERE id = ?", [error, retry, nowIso(), id]);
}

export async function markSkipped(id: string, reason: string): Promise<void> {
  await execute("UPDATE loyalty_sync_queue SET status = 'skipped', last_error = ?, updated_at = ? WHERE id = ?", [reason, nowIso(), id]);
}

export async function saveDryRunResult(id: string, result: Record<string, unknown>): Promise<void> {
  await execute("UPDATE loyalty_sync_queue SET dry_run_result_json = ?, updated_at = ? WHERE id = ?", [JSON.stringify(result), nowIso(), id]);
}

export async function retryFailedEvents(): Promise<number> {
  const timestamp = nowIso();
  await execute("UPDATE loyalty_sync_queue SET status = 'pending', next_retry_at = NULL, updated_at = ? WHERE status = 'failed'", [timestamp]);
  const [row] = await query<{ count: number }>("SELECT changes() AS count");
  return row?.count ?? 0;
}

export async function getSyncQueueStats(): Promise<LoyaltySyncQueueStats> {
  const rows = await query<{ status: string; count: number }>("SELECT status, COUNT(*) AS count FROM loyalty_sync_queue GROUP BY status");
  const [last] = await query<{ updated_at: string | null; last_error: string | null }>(
    "SELECT updated_at, last_error FROM loyalty_sync_queue WHERE status IN ('processing', 'synced', 'failed') ORDER BY updated_at DESC LIMIT 1"
  );
  const stats: LoyaltySyncQueueStats = { pending: 0, processing: 0, synced: 0, failed: 0, skipped: 0, lastAttempt: last?.updated_at ?? null, lastError: last?.last_error ?? null };
  for (const row of rows) {
    if (row.status in stats) {
      (stats as unknown as Record<string, number>)[row.status] = row.count;
    }
  }
  return stats;
}
