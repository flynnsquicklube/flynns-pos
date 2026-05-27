import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";

export interface AuditLogEntry {
  id: string;
  actor_employee_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface AuditLogInput {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  actor_employee_id?: string | null;
  actor_name?: string | null;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const actor = getCurrentEmployeeSnapshot();
    await execute(
      `INSERT INTO audit_log (
        id, actor_employee_id, actor_name, action, entity_type, entity_id,
        summary, before_json, after_json, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId("audit"),
        input.actor_employee_id ?? actor.id,
        input.actor_name ?? actor.display_name,
        input.action,
        input.entity_type,
        input.entity_id ?? null,
        input.summary,
        input.before === undefined ? null : JSON.stringify(input.before),
        input.after === undefined ? null : JSON.stringify(input.after),
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
        nowIso()
      ]
    );
  } catch (error) {
    console.warn("[audit] failed to write audit log", error);
  }
}

export async function listAuditLogs(filters: { search?: string; action?: string; entityType?: string; employeeId?: string; dateFrom?: string; dateTo?: string; limit?: number } = {}): Promise<AuditLogEntry[]> {
  const clauses = ["1 = 1"];
  const params: unknown[] = [];
  if (filters.search?.trim()) {
    clauses.push("(summary LIKE ? OR action LIKE ? OR entity_type LIKE ? OR actor_name LIKE ?)");
    const like = `%${filters.search.trim()}%`;
    params.push(like, like, like, like);
  }
  if (filters.action) {
    clauses.push("action = ?");
    params.push(filters.action);
  }
  if (filters.entityType) {
    clauses.push("entity_type = ?");
    params.push(filters.entityType);
  }
  if (filters.employeeId) {
    clauses.push("actor_employee_id = ?");
    params.push(filters.employeeId);
  }
  if (filters.dateFrom) {
    clauses.push("created_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("created_at <= ?");
    params.push(filters.dateTo);
  }
  params.push(filters.limit ?? 100);
  return query<AuditLogEntry>(`SELECT * FROM audit_log WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`, params);
}

export async function listAuditLogsForEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
  return query<AuditLogEntry>("SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC", [entityType, entityId]);
}

export async function getRecentAuditLogs(limit = 25): Promise<AuditLogEntry[]> {
  return listAuditLogs({ limit });
}
