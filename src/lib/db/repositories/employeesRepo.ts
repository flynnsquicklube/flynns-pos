import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { hashPin, verifyPin } from "../../security/pinHash";
import { writeAuditLog } from "./auditLogRepo";
import type { EmployeeRole } from "../../security/permissions";

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: EmployeeRole;
  pin_hash: string | null;
  active: number;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface EmployeeInput {
  first_name: string;
  last_name: string;
  display_name?: string;
  email?: string | null;
  phone?: string | null;
  role: EmployeeRole;
  active?: number;
  hourly_rate?: number | null;
  pin?: string | null;
}

export async function getOrCreateDefaultEmployee(): Promise<Employee> {
  const existing = await getEmployeeById("emp_brandon_flynn");
  if (existing) return existing;
  const timestamp = nowIso();
  await execute(
    `INSERT OR IGNORE INTO employees (
      id, first_name, last_name, display_name, email, phone, role, pin_hash,
      active, hourly_rate, created_at, updated_at, deleted_at, sync_status
    ) VALUES ('emp_brandon_flynn', 'Brandon', 'Flynn', 'Brandon Flynn', NULL, NULL, 'owner', NULL, 1, NULL, ?, ?, NULL, 'synced')`,
    [timestamp, timestamp]
  );
  const employee = await getEmployeeById("emp_brandon_flynn");
  if (!employee) throw new Error("Default employee was not created.");
  return employee;
}

export async function listEmployees(): Promise<Employee[]> {
  await getOrCreateDefaultEmployee();
  return query<Employee>("SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY active DESC, role ASC, display_name ASC");
}

export async function listActiveEmployees(): Promise<Employee[]> {
  await getOrCreateDefaultEmployee();
  return query<Employee>("SELECT * FROM employees WHERE deleted_at IS NULL AND active = 1 ORDER BY display_name ASC");
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const rows = await query<Employee>("SELECT * FROM employees WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const id = createId("emp");
  const timestamp = nowIso();
  const pin_hash = input.pin ? await hashPin(input.pin) : null;
  const displayName = input.display_name?.trim() || `${input.first_name} ${input.last_name}`.trim();
  await execute(
    `INSERT INTO employees (
      id, first_name, last_name, display_name, email, phone, role, pin_hash,
      active, hourly_rate, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.first_name, input.last_name, displayName, input.email ?? null, input.phone ?? null, input.role, pin_hash, input.active ?? 1, input.hourly_rate ?? null, timestamp, timestamp]
  );
  const employee = await getEmployeeById(id);
  if (!employee) throw new Error("Employee was not created.");
  await writeAuditLog({ action: "employee.created", entity_type: "employee", entity_id: id, summary: `Created employee ${displayName}`, after: employee });
  return employee;
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput>): Promise<void> {
  const current = await getEmployeeById(id);
  if (!current) throw new Error("Employee not found.");
  const pin_hash = input.pin ? await hashPin(input.pin) : current.pin_hash;
  const next = {
    first_name: input.first_name ?? current.first_name,
    last_name: input.last_name ?? current.last_name,
    display_name: input.display_name ?? current.display_name,
    email: input.email ?? current.email,
    phone: input.phone ?? current.phone,
    role: input.role ?? current.role,
    pin_hash,
    active: input.active ?? current.active,
    hourly_rate: input.hourly_rate ?? current.hourly_rate
  };
  await execute(
    `UPDATE employees SET first_name = ?, last_name = ?, display_name = ?, email = ?, phone = ?,
      role = ?, pin_hash = ?, active = ?, hourly_rate = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [next.first_name, next.last_name, next.display_name, next.email, next.phone, next.role, next.pin_hash, next.active, next.hourly_rate, nowIso(), id]
  );
  await writeAuditLog({ action: "employee.updated", entity_type: "employee", entity_id: id, summary: `Updated employee ${next.display_name}`, before: current, after: { ...current, ...next } });
}

export async function verifyEmployeePin(employeeId: string, pin: string): Promise<Employee> {
  const employee = await getEmployeeById(employeeId);
  if (!employee || !employee.active) throw new Error("Employee not available.");
  if (!(await verifyPin(pin, employee.pin_hash))) throw new Error("Invalid PIN.");
  return employee;
}
