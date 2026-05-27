import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { writeAuditLog } from "./auditLogRepo";
import type { ServicePackage, ServicePackageInput } from "../../../types/servicePackage";

export async function listActivePackages(): Promise<ServicePackage[]> {
  return query<ServicePackage>("SELECT * FROM service_packages WHERE deleted_at IS NULL AND active = 1 AND COALESCE(visible_in_start_ticket, 1) = 1 ORDER BY sort_order ASC, name ASC");
}

export async function listPackages(): Promise<ServicePackage[]> {
  return query<ServicePackage>("SELECT * FROM service_packages WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC");
}

export async function getPackageById(id: string): Promise<ServicePackage | null> {
  const rows = await query<ServicePackage>("SELECT * FROM service_packages WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function getPackageWorkflowDetails(id: string): Promise<ServicePackage | null> {
  return getPackageById(id);
}

export async function createPackage(input: ServicePackageInput): Promise<ServicePackage> {
  const id = createId("pkg");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO service_packages (
      id, external_source, external_id, name, internal_name, description, category, base_price,
      package_total, base_service_amount, disposal_fee_amount, disposal_fee_quantity,
      mileage_interval, time_interval_months, service_1_id, service_1_name, service_2_id,
      service_2_name, services_json, package_group_name, oil_brand, oil_type, included_quarts,
      extra_quart_price, included_filter_type, cartridge_filter_extra_fee,
      max_included_filter_cost, taxable, active, visible_in_start_ticket, sort_order, created_at, updated_at,
      deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      id,
      input.external_source ?? null,
      input.external_id ?? null,
      input.name,
      input.internal_name ?? null,
      input.description ?? null,
      input.category,
      input.base_price,
      input.package_total ?? input.base_price,
      input.base_service_amount ?? input.base_price,
      input.disposal_fee_amount ?? 0,
      input.disposal_fee_quantity ?? null,
      input.mileage_interval ?? null,
      input.time_interval_months ?? null,
      input.service_1_id ?? null,
      input.service_1_name ?? null,
      input.service_2_id ?? null,
      input.service_2_name ?? null,
      input.services_json ?? null,
      input.package_group_name ?? null,
      input.oil_brand ?? null,
      input.oil_type ?? null,
      input.included_quarts,
      input.extra_quart_price,
      input.included_filter_type ?? "standard",
      input.cartridge_filter_extra_fee,
      input.max_included_filter_cost ?? null,
      input.taxable ?? 1,
      input.active ?? 1,
      input.visible_in_start_ticket ?? 1,
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
      external_source = ?, external_id = ?, name = ?, internal_name = ?, description = ?,
      category = ?, base_price = ?, package_total = ?, base_service_amount = ?,
      disposal_fee_amount = ?, disposal_fee_quantity = ?, mileage_interval = ?,
      time_interval_months = ?, service_1_id = ?, service_1_name = ?, service_2_id = ?,
      service_2_name = ?, services_json = ?, package_group_name = ?, oil_brand = ?, oil_type = ?,
      included_quarts = ?, extra_quart_price = ?, included_filter_type = ?,
      cartridge_filter_extra_fee = ?, max_included_filter_cost = ?, taxable = ?, active = ?,
      visible_in_start_ticket = ?,
      sort_order = ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [
      input.external_source ?? current.external_source,
      input.external_id ?? current.external_id,
      input.name ?? current.name,
      input.internal_name ?? current.internal_name,
      input.description ?? current.description,
      input.category ?? current.category,
      input.base_price ?? current.base_price,
      input.package_total ?? current.package_total ?? input.base_price ?? current.base_price,
      input.base_service_amount ?? current.base_service_amount ?? input.base_price ?? current.base_price,
      input.disposal_fee_amount ?? current.disposal_fee_amount ?? 0,
      input.disposal_fee_quantity ?? current.disposal_fee_quantity,
      input.mileage_interval ?? current.mileage_interval,
      input.time_interval_months ?? current.time_interval_months,
      input.service_1_id ?? current.service_1_id,
      input.service_1_name ?? current.service_1_name,
      input.service_2_id ?? current.service_2_id,
      input.service_2_name ?? current.service_2_name,
      input.services_json ?? current.services_json,
      input.package_group_name ?? current.package_group_name,
      input.oil_brand ?? current.oil_brand,
      input.oil_type ?? current.oil_type,
      input.included_quarts ?? current.included_quarts,
      input.extra_quart_price ?? current.extra_quart_price,
      input.included_filter_type ?? current.included_filter_type,
      input.cartridge_filter_extra_fee ?? current.cartridge_filter_extra_fee,
      input.max_included_filter_cost ?? current.max_included_filter_cost,
      input.taxable ?? current.taxable,
      input.active ?? current.active,
      input.visible_in_start_ticket ?? current.visible_in_start_ticket ?? 1,
      input.sort_order ?? current.sort_order,
      nowIso(),
      id
    ]
  );
  await writeAuditLog({ action: "package.updated", entity_type: "service_package", entity_id: id, summary: `Updated package ${input.name ?? current.name}`, before: current, after: input });
}

export async function deactivatePackage(id: string): Promise<void> {
  await execute("UPDATE service_packages SET active = 0, updated_at = ?, sync_status = 'pending' WHERE id = ?", [nowIso(), id]);
}

export async function setPackageActive(id: string, active: boolean): Promise<void> {
  const current = await getPackageById(id);
  if (!current) throw new Error("Package not found.");
  await execute("UPDATE service_packages SET active = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [active ? 1 : 0, nowIso(), id]);
  await writeAuditLog({ action: active ? "package.enabled" : "package.disabled", entity_type: "service_package", entity_id: id, summary: `${active ? "Enabled" : "Disabled"} package ${current.name}`, before: current, after: { active: active ? 1 : 0 } });
}

export async function getNextSortOrder(): Promise<number> {
  const rows = await query<{ nextSortOrder: number }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextSortOrder FROM service_packages WHERE deleted_at IS NULL");
  return rows[0]?.nextSortOrder ?? 1;
}

export async function duplicatePackage(id: string): Promise<ServicePackage> {
  const current = await getPackageById(id);
  if (!current) throw new Error("Package not found.");
  const nextSortOrder = await getNextSortOrder();
  const copy = await createPackage({
    name: `Copy of ${current.name}`,
    external_source: null,
    external_id: null,
    internal_name: current.internal_name ? `COPY_${current.internal_name}` : null,
    description: current.description,
    category: current.category,
    base_price: current.base_price,
    package_total: current.package_total ?? current.base_price,
    base_service_amount: current.base_service_amount ?? current.base_price,
    disposal_fee_amount: current.disposal_fee_amount ?? 0,
    disposal_fee_quantity: current.disposal_fee_quantity,
    mileage_interval: current.mileage_interval,
    time_interval_months: current.time_interval_months,
    service_1_id: current.service_1_id,
    service_1_name: current.service_1_name,
    service_2_id: current.service_2_id,
    service_2_name: current.service_2_name,
    services_json: current.services_json,
    package_group_name: current.package_group_name,
    oil_brand: current.oil_brand,
    oil_type: current.oil_type,
    included_quarts: current.included_quarts,
    extra_quart_price: current.extra_quart_price,
    included_filter_type: current.included_filter_type,
    cartridge_filter_extra_fee: current.cartridge_filter_extra_fee,
    max_included_filter_cost: current.max_included_filter_cost,
    taxable: current.taxable,
    active: 0,
    visible_in_start_ticket: current.visible_in_start_ticket ?? 1,
    sort_order: nextSortOrder
  });
  await writeAuditLog({ action: "package.duplicated", entity_type: "service_package", entity_id: copy.id, summary: `Duplicated package ${current.name}`, before: current, after: copy });
  return copy;
}

export async function findPackageByExternalId(externalSource: string, externalId: string): Promise<ServicePackage | null> {
  const rows = await query<ServicePackage>(
    "SELECT * FROM service_packages WHERE external_source = ? AND external_id = ? AND deleted_at IS NULL",
    [externalSource, externalId]
  );
  return rows[0] ?? null;
}

export async function findPackageByName(name: string): Promise<ServicePackage | null> {
  const rows = await query<ServicePackage>(
    "SELECT * FROM service_packages WHERE lower(name) = lower(?) AND deleted_at IS NULL ORDER BY CASE WHEN external_source = 'droptop' THEN 0 ELSE 1 END LIMIT 1",
    [name]
  );
  return rows[0] ?? null;
}

export async function upsertDroptopPackage(input: ServicePackageInput & { external_id: string }): Promise<"created" | "updated"> {
  const existing = await findPackageByExternalId("droptop", input.external_id);
  if (existing) {
    await updatePackage(existing.id, { ...input, external_source: "droptop" });
    return "updated";
  }
  const nameMatch = await findPackageByName(input.name);
  if (nameMatch && nameMatch.external_source !== "droptop") {
    await updatePackage(nameMatch.id, { ...input, external_source: "droptop" });
    return "updated";
  }
  await createPackage({ ...input, external_source: "droptop" });
  return "created";
}

function normalizePackageName(value: string): string {
  return value.toLowerCase().replace(/\boil change\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function deactivateLocalDuplicatePackages(importedNames: string[]): Promise<number> {
  const normalizedImported = new Set(importedNames.map(normalizePackageName).filter(Boolean));
  if (!normalizedImported.size) return 0;
  const localPackages = await query<ServicePackage>(
    "SELECT * FROM service_packages WHERE deleted_at IS NULL AND COALESCE(external_source, '') <> 'droptop' AND active = 1"
  );
  let deactivated = 0;
  for (const localPackage of localPackages) {
    if (normalizedImported.has(normalizePackageName(localPackage.name))) {
      await setPackageActive(localPackage.id, false);
      deactivated += 1;
    }
  }
  return deactivated;
}
