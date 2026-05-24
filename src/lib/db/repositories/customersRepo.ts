import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { Customer, CustomerInput } from "../../../types/customer";

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
