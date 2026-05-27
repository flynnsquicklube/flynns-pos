import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { writeAuditLog } from "./auditLogRepo";

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  inventory_count?: number;
}

export async function listSuppliers(): Promise<Supplier[]> {
  return query<Supplier>(
    `SELECT s.*, COUNT(ii.id) AS inventory_count
     FROM suppliers s
     LEFT JOIN inventory_items ii ON ii.deleted_at IS NULL AND (ii.supplier = s.name OR ii.vendor = s.name OR ii.brand = s.name)
     GROUP BY s.id
     ORDER BY s.active DESC, s.name ASC`
  );
}

export async function createSupplier(input: Partial<Supplier> & { name: string }): Promise<Supplier> {
  const id = createId("sup");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO suppliers (id, name, contact_name, phone, email, website, notes, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name.trim(), input.contact_name ?? null, input.phone ?? null, input.email ?? null, input.website ?? null, input.notes ?? null, input.active ?? 1, timestamp, timestamp]
  );
  const supplier = (await query<Supplier>("SELECT * FROM suppliers WHERE id = ?", [id]))[0];
  await writeAuditLog({ action: "inventory.supplier_created", entity_type: "supplier", entity_id: id, summary: `Created supplier ${supplier.name}`, after: supplier });
  return supplier;
}

export async function updateSupplier(id: string, input: Partial<Supplier>): Promise<void> {
  const [current] = await query<Supplier>("SELECT * FROM suppliers WHERE id = ?", [id]);
  if (!current) throw new Error("Supplier not found.");
  await execute(
    `UPDATE suppliers SET name = ?, contact_name = ?, phone = ?, email = ?, website = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?`,
    [
      input.name ?? current.name,
      input.contact_name ?? current.contact_name,
      input.phone ?? current.phone,
      input.email ?? current.email,
      input.website ?? current.website,
      input.notes ?? current.notes,
      input.active ?? current.active,
      nowIso(),
      id
    ]
  );
  await writeAuditLog({ action: "inventory.supplier_updated", entity_type: "supplier", entity_id: id, summary: `Updated supplier ${input.name ?? current.name}`, before: current, after: input });
}

export async function deactivateSupplier(id: string): Promise<void> {
  await updateSupplier(id, { active: 0 });
}

export async function listSupplierNameSuggestions(limit = 25): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT name
     FROM (
       SELECT TRIM(COALESCE(supplier, vendor, brand, '')) AS name, COUNT(*) AS item_count
       FROM inventory_items
       WHERE deleted_at IS NULL
       GROUP BY TRIM(COALESCE(supplier, vendor, brand, ''))
     )
     WHERE name <> ''
     ORDER BY item_count DESC, name ASC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => row.name);
}
