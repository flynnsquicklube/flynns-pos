import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { Service } from "../../../types/service";

export type ServiceInput = Omit<Service, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;

export async function listServices(): Promise<Service[]> {
  return query<Service>("SELECT * FROM services WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC");
}

export async function listActiveServices(): Promise<Service[]> {
  return query<Service>("SELECT * FROM services WHERE deleted_at IS NULL AND active = 1 ORDER BY sort_order ASC, name ASC");
}

export async function getService(id: string): Promise<Service | null> {
  const rows = await query<Service>("SELECT * FROM services WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export const getServiceById = getService;

export async function createService(input: ServiceInput): Promise<Service> {
  const id = createId("svc");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO services (
      id, name, category, description, base_price, taxable, active, is_oil_change,
      sort_order, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.name, input.category, input.description, input.base_price, input.taxable, input.active, input.is_oil_change, input.sort_order, timestamp, timestamp]
  );
  const service = await getService(id);
  if (!service) throw new Error("Service was not created.");
  return service;
}

export async function updateService(id: string, input: Partial<ServiceInput>): Promise<void> {
  const current = await getService(id);
  if (!current) throw new Error("Service not found.");
  await execute(
    `UPDATE services SET
      name = ?, category = ?, description = ?, base_price = ?, taxable = ?, active = ?,
      is_oil_change = ?, sort_order = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.name ?? current.name,
      input.category ?? current.category,
      input.description ?? current.description,
      input.base_price ?? current.base_price,
      input.taxable ?? current.taxable,
      input.active ?? current.active,
      input.is_oil_change ?? current.is_oil_change,
      input.sort_order ?? current.sort_order,
      nowIso(),
      id
    ]
  );
}

export async function deleteService(id: string): Promise<void> {
  await execute("UPDATE services SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), nowIso(), id]);
}
