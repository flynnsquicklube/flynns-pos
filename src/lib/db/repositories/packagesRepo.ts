import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { ServicePackage, ServicePackageInput } from "../../../types/servicePackage";

export async function listActivePackages(): Promise<ServicePackage[]> {
  return query<ServicePackage>("SELECT * FROM service_packages WHERE deleted_at IS NULL AND active = 1 ORDER BY sort_order ASC, name ASC");
}

export async function listPackages(): Promise<ServicePackage[]> {
  return query<ServicePackage>("SELECT * FROM service_packages WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC");
}

export async function getPackageById(id: string): Promise<ServicePackage | null> {
  const rows = await query<ServicePackage>("SELECT * FROM service_packages WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function createPackage(input: ServicePackageInput): Promise<ServicePackage> {
  const id = createId("pkg");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO service_packages (
      id, name, description, category, base_price, oil_brand, oil_type, included_quarts,
      extra_quart_price, included_filter_type, cartridge_filter_extra_fee,
      max_included_filter_cost, taxable, active, sort_order, created_at, updated_at,
      deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      id,
      input.name,
      input.description ?? null,
      input.category,
      input.base_price,
      input.oil_brand ?? null,
      input.oil_type ?? null,
      input.included_quarts,
      input.extra_quart_price,
      input.included_filter_type ?? "standard",
      input.cartridge_filter_extra_fee,
      input.max_included_filter_cost ?? null,
      input.taxable ?? 1,
      input.active ?? 1,
      input.sort_order ?? 0,
      timestamp,
      timestamp
    ]
  );
  const servicePackage = await getPackageById(id);
  if (!servicePackage) throw new Error("Package was not created.");
  return servicePackage;
}

export async function updatePackage(id: string, input: Partial<ServicePackageInput>): Promise<void> {
  const current = await getPackageById(id);
  if (!current) throw new Error("Package not found.");
  await execute(
    `UPDATE service_packages SET
      name = ?, description = ?, category = ?, base_price = ?, oil_brand = ?, oil_type = ?,
      included_quarts = ?, extra_quart_price = ?, included_filter_type = ?,
      cartridge_filter_extra_fee = ?, max_included_filter_cost = ?, taxable = ?, active = ?,
      sort_order = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.name ?? current.name,
      input.description ?? current.description,
      input.category ?? current.category,
      input.base_price ?? current.base_price,
      input.oil_brand ?? current.oil_brand,
      input.oil_type ?? current.oil_type,
      input.included_quarts ?? current.included_quarts,
      input.extra_quart_price ?? current.extra_quart_price,
      input.included_filter_type ?? current.included_filter_type,
      input.cartridge_filter_extra_fee ?? current.cartridge_filter_extra_fee,
      input.max_included_filter_cost ?? current.max_included_filter_cost,
      input.taxable ?? current.taxable,
      input.active ?? current.active,
      input.sort_order ?? current.sort_order,
      nowIso(),
      id
    ]
  );
}

export async function deactivatePackage(id: string): Promise<void> {
  await execute("UPDATE service_packages SET active = 0, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), id]);
}
