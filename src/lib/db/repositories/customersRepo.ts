import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { Customer, CustomerInput } from "../../../types/customer";
import { normalizePhone } from "../../utils/phone";

export type CustomerQuickFilter = "recent" | "imported" | "withVehicles" | "openTickets";

export interface CustomerStats {
  totalCustomers: number;
  importedCustomers: number;
  customersWithVehicles: number;
  recentCustomers: number;
}

export interface CustomerSearchFilters {
  recent?: boolean;
  imported?: boolean;
  withVehicles?: boolean;
  openTickets?: boolean;
}

export interface CustomerSearchResult extends Customer {
  vehicle_count: number;
  last_visit: string | null;
  open_ticket_count: number;
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  const like = `%${search.trim()}%`;
  return query<Customer>(
    `SELECT * FROM customers
     WHERE deleted_at IS NULL
       AND (
        ? = '%%'
        OR first_name LIKE ?
        OR last_name LIKE ?
        OR phone LIKE ?
        OR email LIKE ?
        OR EXISTS (
          SELECT 1 FROM vehicles
          WHERE vehicles.customer_id = customers.id
            AND vehicles.deleted_at IS NULL
            AND (vehicles.plate LIKE ? OR vehicles.vin LIKE ?)
        )
       )
     ORDER BY updated_at DESC`,
    [like, like, like, like, like, like, like]
  );
}

export async function searchCustomers(search: string): Promise<Customer[]> {
  return listCustomers(search);
}

function customerSearchWhere(queryText: string, filters: CustomerSearchFilters, params: unknown[]) {
  const clauses = ["c.deleted_at IS NULL"];
  const trimmed = queryText.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    const phoneDigits = normalizePhone(trimmed);
    const phoneLike = `%${phoneDigits}%`;
    clauses.push(`(
      c.first_name LIKE ?
      OR c.last_name LIKE ?
      OR (c.first_name || ' ' || c.last_name) LIKE ?
      OR c.phone LIKE ?
      OR (? != '' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(c.phone, '-', ''), '(', ''), ')', ''), ' ', ''), '.', '') LIKE ?)
      OR c.email LIKE ?
      OR EXISTS (
        SELECT 1 FROM vehicles v
        WHERE v.customer_id = c.id
          AND v.deleted_at IS NULL
          AND (
            v.vin LIKE ?
            OR v.plate LIKE ?
            OR CAST(v.year AS TEXT) LIKE ?
            OR v.make LIKE ?
            OR v.model LIKE ?
          )
      )
    )`);
    params.push(like, like, like, like, phoneDigits, phoneLike, like, like, like, like, like, like);
  }
  if (filters.imported) clauses.push("COALESCE(c.is_imported, 0) = 1");
  if (filters.withVehicles) clauses.push("EXISTS (SELECT 1 FROM vehicles v WHERE v.customer_id = c.id AND v.deleted_at IS NULL)");
  if (filters.openTickets) clauses.push("EXISTS (SELECT 1 FROM tickets t WHERE t.customer_id = c.id AND t.deleted_at IS NULL AND t.status IN ('checked_in', 'in_service', 'waiting_payment'))");
  if (filters.recent) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    clauses.push("c.updated_at >= ?");
    params.push(since.toISOString());
  }
  return clauses.join(" AND ");
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const [row] = await query<CustomerStats>(
    `SELECT
      COUNT(*) AS totalCustomers,
      COALESCE(SUM(CASE WHEN COALESCE(is_imported, 0) = 1 THEN 1 ELSE 0 END), 0) AS importedCustomers,
      COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM vehicles v WHERE v.customer_id = customers.id AND v.deleted_at IS NULL) THEN 1 ELSE 0 END), 0) AS customersWithVehicles,
      COALESCE(SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END), 0) AS recentCustomers
     FROM customers
     WHERE deleted_at IS NULL`,
    [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]
  );
  return row ?? { totalCustomers: 0, importedCustomers: 0, customersWithVehicles: 0, recentCustomers: 0 };
}

export async function searchCustomersAdvanced(queryText = "", filters: CustomerSearchFilters = {}, limit = 50, offset = 0): Promise<CustomerSearchResult[]> {
  const params: unknown[] = [];
  const where = customerSearchWhere(queryText, filters, params);
  params.push(limit, offset);
  return query<CustomerSearchResult>(
    `SELECT c.*,
      (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id AND v.deleted_at IS NULL) AS vehicle_count,
      (SELECT MAX(COALESCE(t.completed_at, t.created_at)) FROM tickets t WHERE t.customer_id = c.id AND t.deleted_at IS NULL) AS last_visit,
      (SELECT COUNT(*) FROM tickets t WHERE t.customer_id = c.id AND t.deleted_at IS NULL AND t.status IN ('checked_in', 'in_service', 'waiting_payment')) AS open_ticket_count
     FROM customers c
     WHERE ${where}
     ORDER BY COALESCE(last_visit, c.updated_at) DESC
     LIMIT ? OFFSET ?`,
    params
  );
}

export async function listRecentCustomers(limit = 10): Promise<CustomerSearchResult[]> {
  return searchCustomersAdvanced("", {}, limit, 0);
}

export async function countCustomerSearchResults(queryText = "", filters: CustomerSearchFilters = {}): Promise<number> {
  const params: unknown[] = [];
  const where = customerSearchWhere(queryText, filters, params);
  const [row] = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM customers c WHERE ${where}`, params);
  return row?.count ?? 0;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const rows = await query<Customer>("SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export const getCustomerById = getCustomer;

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const id = createId("cust");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO customers (
      id, first_name, last_name, phone, email, notes, firebase_uid, referral_code,
      created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.first_name, input.last_name, input.phone, input.email, input.notes, input.firebase_uid, input.referral_code, timestamp, timestamp]
  );
  const customer = await getCustomer(id);
  if (!customer) throw new Error("Customer was not created.");
  return customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<void> {
  const current = await getCustomer(id);
  if (!current) throw new Error("Customer not found.");
  await execute(
    `UPDATE customers SET
      first_name = ?, last_name = ?, phone = ?, email = ?, notes = ?, firebase_uid = ?,
      referral_code = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.first_name ?? current.first_name,
      input.last_name ?? current.last_name,
      input.phone ?? current.phone,
      input.email ?? current.email,
      input.notes ?? current.notes,
      input.firebase_uid ?? current.firebase_uid,
      input.referral_code ?? current.referral_code,
      nowIso(),
      id
    ]
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  await execute("UPDATE customers SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), nowIso(), id]);
}
