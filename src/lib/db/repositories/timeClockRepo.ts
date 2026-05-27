import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { writeAuditLog } from "./auditLogRepo";

export type TimeEntryType = "clock_in" | "clock_out" | "break_start" | "break_end" | "manual_adjustment";
export type TimeClockStatus = "clocked_in" | "on_break" | "clocked_out";

export interface EmployeeTimeEntry {
  id: string;
  employee_id: string;
  entry_type: TimeEntryType;
  timestamp: string;
  note: string | null;
  created_at: string;
  created_by_employee_id: string | null;
  edited_at: string | null;
  edited_by_employee_id: string | null;
  deleted_at: string | null;
  sync_status: string;
  employee_name?: string;
}

export interface TimeClockSession {
  id: string;
  employee_id: string;
  status: TimeClockStatus;
  clocked_in_at: string | null;
  break_started_at: string | null;
  clocked_out_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
}

async function writeTimeEntry(employeeId: string, entryType: TimeEntryType, note?: string | null) {
  const id = createId("time");
  const timestamp = nowIso();
  const actor = getCurrentEmployeeSnapshot();
  await execute(
    `INSERT INTO employee_time_entries (id, employee_id, entry_type, timestamp, note, created_at, created_by_employee_id, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, employeeId, entryType, timestamp, note ?? null, timestamp, actor.id]
  );
  await writeAuditLog({ action: `employee.${entryType}`, entity_type: "employee", entity_id: employeeId, summary: `Employee ${entryType.replace("_", " ")}` });
}

async function upsertSession(employeeId: string, patch: Partial<TimeClockSession>) {
  const existing = await getCurrentEmployeeStatus(employeeId);
  const timestamp = nowIso();
  if (existing) {
    await execute(
      `UPDATE timeclock_sessions SET status = ?, clocked_in_at = ?, break_started_at = ?, clocked_out_at = ?, updated_at = ? WHERE id = ?`,
      [
        patch.status ?? existing.status,
        patch.clocked_in_at ?? existing.clocked_in_at,
        patch.break_started_at === undefined ? existing.break_started_at : patch.break_started_at,
        patch.clocked_out_at === undefined ? existing.clocked_out_at : patch.clocked_out_at,
        timestamp,
        existing.id
      ]
    );
    return;
  }
  await execute(
    `INSERT INTO timeclock_sessions (id, employee_id, status, clocked_in_at, break_started_at, clocked_out_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId("session"), employeeId, patch.status ?? "clocked_out", patch.clocked_in_at ?? null, patch.break_started_at ?? null, patch.clocked_out_at ?? null, timestamp, timestamp]
  );
}

export async function clockIn(employeeId: string): Promise<void> {
  const timestamp = nowIso();
  await upsertSession(employeeId, { status: "clocked_in", clocked_in_at: timestamp, break_started_at: null, clocked_out_at: null });
  await writeTimeEntry(employeeId, "clock_in");
}

export async function startBreak(employeeId: string): Promise<void> {
  await upsertSession(employeeId, { status: "on_break", break_started_at: nowIso(), clocked_out_at: null });
  await writeTimeEntry(employeeId, "break_start");
}

export async function endBreak(employeeId: string): Promise<void> {
  await upsertSession(employeeId, { status: "clocked_in", break_started_at: null, clocked_out_at: null });
  await writeTimeEntry(employeeId, "break_end");
}

export async function clockOut(employeeId: string): Promise<void> {
  await upsertSession(employeeId, { status: "clocked_out", break_started_at: null, clocked_out_at: nowIso() });
  await writeTimeEntry(employeeId, "clock_out");
}

export async function getCurrentEmployeeStatus(employeeId: string): Promise<TimeClockSession | null> {
  const rows = await query<TimeClockSession>(
    `SELECT s.*, e.display_name AS employee_name
     FROM timeclock_sessions s
     JOIN employees e ON e.id = s.employee_id
     WHERE s.employee_id = ?
     ORDER BY s.updated_at DESC
     LIMIT 1`,
    [employeeId]
  );
  return rows[0] ?? null;
}

export async function listClockedInEmployees(): Promise<TimeClockSession[]> {
  return query<TimeClockSession>(
    `SELECT s.*, e.display_name AS employee_name
     FROM timeclock_sessions s
     JOIN employees e ON e.id = s.employee_id
     WHERE s.status IN ('clocked_in', 'on_break')
     ORDER BY s.clocked_in_at ASC`
  );
}

export async function listTimeEntries(range: { dateFrom?: string; dateTo?: string } = {}): Promise<EmployeeTimeEntry[]> {
  const clauses = ["te.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (range.dateFrom) {
    clauses.push("te.timestamp >= ?");
    params.push(range.dateFrom);
  }
  if (range.dateTo) {
    clauses.push("te.timestamp <= ?");
    params.push(range.dateTo);
  }
  return query<EmployeeTimeEntry>(
    `SELECT te.*, e.display_name AS employee_name
     FROM employee_time_entries te
     JOIN employees e ON e.id = te.employee_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY te.timestamp DESC
     LIMIT 200`,
    params
  );
}

export async function editTimeEntry(id: string, input: { timestamp?: string; note?: string | null }): Promise<void> {
  const actor = getCurrentEmployeeSnapshot();
  await execute(
    "UPDATE employee_time_entries SET timestamp = COALESCE(?, timestamp), note = ?, edited_at = ?, edited_by_employee_id = ?, sync_status = 'pending' WHERE id = ?",
    [input.timestamp ?? null, input.note ?? null, nowIso(), actor.id, id]
  );
  await writeAuditLog({ action: "employee.time_entry_edited", entity_type: "employee_time_entry", entity_id: id, summary: "Edited time entry" });
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const actor = getCurrentEmployeeSnapshot();
  await execute("UPDATE employee_time_entries SET deleted_at = ?, edited_by_employee_id = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), actor.id, id]);
  await writeAuditLog({ action: "employee.time_entry_deleted", entity_type: "employee_time_entry", entity_id: id, summary: "Deleted time entry" });
}

export async function getPayPeriodSummary(range: { dateFrom?: string; dateTo?: string } = {}): Promise<{ employeeId: string; employeeName: string; entries: number }[]> {
  const entries = await listTimeEntries(range);
  const map = new Map<string, { employeeId: string; employeeName: string; entries: number }>();
  entries.forEach((entry) => {
    const current = map.get(entry.employee_id) ?? { employeeId: entry.employee_id, employeeName: entry.employee_name ?? entry.employee_id, entries: 0 };
    current.entries += 1;
    map.set(entry.employee_id, current);
  });
  return [...map.values()];
}
