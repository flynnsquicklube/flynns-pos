import { addImportError, createImportBatch, finishImportBatch } from "../db/repositories/importRepo";
import { deactivateLocalDuplicatePackages, findPackageByExternalId, upsertDroptopPackage } from "../db/repositories/packagesRepo";
import { cleanValue, parseDroptopCsv, parseMoney, parseNumber } from "./droptopCsvParser";
import type { ImportErrorInfo, PackageImportPreview, PackageImportResult, ParsedCsvRow } from "./importTypes";
import type { ServicePackageInput } from "../../types/servicePackage";

const profileHeaders = ["Package ID", "Name", "Package Total", "Base Service Amount"];
const accessibilityHeaders = ["Package ID", "Package Name", "Operation ID", "Operation Name"];
const flynnsOperationName = "flynn's quick lube";

export function parseDroptopPackageProfiles(text: string): ParsedCsvRow[] {
  return parseDroptopCsv(text, profileHeaders);
}

export function parseDroptopPackageAccessibility(text: string): ParsedCsvRow[] {
  return parseDroptopCsv(text, accessibilityHeaders);
}

function normalize(value: string | null | undefined): string {
  return cleanValue(value)?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function buildAccessiblePackageIds(accessibilityText?: string | null): Set<string> | null {
  if (!accessibilityText) return null;
  const rows = parseDroptopPackageAccessibility(accessibilityText);
  const ids = new Set<string>();
  for (const row of rows) {
    const operationName = normalize(row.values["Operation Name"]);
    const packageId = cleanValue(row.values["Package ID"]);
    if (packageId && operationName === flynnsOperationName) ids.add(packageId);
  }
  return ids;
}

function inferOilInfo(name: string): { oilBrand: string | null; oilType: string | null; includedQuarts: number } {
  const normalized = name.toLowerCase();
  if (normalized.includes("customer own oil")) return { oilBrand: "Customer supplied", oilType: "Own oil and filter", includedQuarts: 0 };
  if (normalized.includes("diesel")) return { oilBrand: null, oilType: "Diesel", includedQuarts: 10 };
  if (normalized.includes("synthetic blend")) return { oilBrand: "Duramax", oilType: "Synthetic Blend", includedQuarts: 6 };
  if (normalized.includes("duramax")) return { oilBrand: "Duramax", oilType: "Full Synthetic", includedQuarts: 6 };
  if (normalized.includes("mobil 1")) return { oilBrand: "Mobil 1", oilType: "Full Synthetic", includedQuarts: 5 };
  if (normalized.includes("castrol")) return { oilBrand: "Castrol Edge", oilType: "Full Synthetic", includedQuarts: 5 };
  if (normalized.includes("argos")) return { oilBrand: "Argos", oilType: "Full Synthetic", includedQuarts: 5 };
  if (normalized.includes("conventional")) return { oilBrand: null, oilType: "Conventional", includedQuarts: 5 };
  return { oilBrand: null, oilType: null, includedQuarts: 5 };
}

function isOilChange(row: Record<string, string | null>): boolean {
  const group = normalize(row["Package Group 1 Name"]);
  const services = `${normalize(row["Service 1 Name"])} ${normalize(row["Service 2 Name"])}`;
  return group.includes("oil change") || services.includes("engine oil");
}

function rowToPackageInput(row: Record<string, string | null>, active: boolean, sortOrder: number): ServicePackageInput & { external_id: string } {
  const externalId = cleanValue(row["Package ID"]);
  const name = cleanValue(row.Name);
  if (!externalId) throw new Error("Missing Package ID.");
  if (!name) throw new Error("Missing package name.");
  const packageTotal = parseMoney(row["Package Total"]);
  const baseServiceAmount = parseMoney(row["Base Service Amount"]);
  const casualItemName = normalize(row["Casual Item 1 Name"]);
  const disposalFee = casualItemName.includes("disposal") ? parseMoney(row["Casual Item 1 Amount"]) : 0;
  const oilInfo = inferOilInfo(name);
  const groupName = cleanValue(row["Package Group 1 Name"]);
  return {
    external_source: "droptop",
    external_id: externalId,
    name,
    internal_name: cleanValue(row["Internal Name"]),
    description: cleanValue(row.Description) ?? cleanValue(row["Description on Order Invoice"]),
    category: groupName ?? cleanValue(row["Financial Category"]) ?? (isOilChange(row) ? "OIL CHANGE" : "Service"),
    base_price: packageTotal,
    package_total: packageTotal,
    base_service_amount: baseServiceAmount,
    disposal_fee_amount: disposalFee,
    disposal_fee_quantity: parseNumber(row["Casual Item 1 Quantity"]),
    mileage_interval: parseNumber(row["Mileage Interval"]),
    time_interval_months: parseNumber(row["Time Interval (Months)"]),
    service_1_id: cleanValue(row["Service 1 ID"]),
    service_1_name: cleanValue(row["Service 1 Name"]),
    service_2_id: cleanValue(row["Service 2 ID"]),
    service_2_name: cleanValue(row["Service 2 Name"]),
    services_json: JSON.stringify([cleanValue(row["Service 1 Name"]), cleanValue(row["Service 2 Name"])].filter(Boolean).map((name) => ({ name }))),
    package_group_name: groupName,
    oil_brand: oilInfo.oilBrand,
    oil_type: oilInfo.oilType,
    included_quarts: oilInfo.includedQuarts,
    extra_quart_price: 0,
    included_filter_type: isOilChange(row) ? "standard" : "none",
    cartridge_filter_extra_fee: 0,
    max_included_filter_cost: null,
    taxable: cleanValue(row["Tax Exempt Package Total"])?.toLowerCase() === "yes" ? 0 : 1,
    active: active ? 1 : 0,
    visible_in_start_ticket: active ? 1 : 0,
    sort_order: sortOrder
  };
}

export async function previewDroptopPackages(profileText: string, accessibilityText?: string | null): Promise<PackageImportPreview> {
  const rows = parseDroptopPackageProfiles(profileText);
  const accessibleIds = buildAccessiblePackageIds(accessibilityText);
  let existing = 0;
  let accessibleRows = 0;
  for (const row of rows) {
    const packageId = cleanValue(row.values["Package ID"]);
    if (packageId && (!accessibleIds || accessibleIds.has(packageId))) accessibleRows += 1;
    if (packageId && await findPackageByExternalId("droptop", packageId)) existing += 1;
  }
  return {
    totalRows: rows.length,
    accessibleRows,
    estimatedNewPackages: rows.length - existing,
    estimatedUpdatedPackages: existing,
    rowsPreview: rows.slice(0, 5),
    errors: []
  };
}

export async function importDroptopPackages(profileText: string, accessibilityText: string | null, fileName: string): Promise<PackageImportResult> {
  const rows = parseDroptopPackageProfiles(profileText);
  const accessibleIds = buildAccessiblePackageIds(accessibilityText);
  const batchId = await createImportBatch({ source: "droptop", fileName, importType: "packages", rowsTotal: rows.length });
  const errors: ImportErrorInfo[] = [];
  const result = { imported: 0, skipped: 0, failed: 0, packagesCreated: 0, packagesUpdated: 0, packagesAccessible: 0, duplicatesDeactivated: 0 };
  const importedNames: string[] = [];

  for (const parsedRow of rows) {
    try {
      const packageId = cleanValue(parsedRow.values["Package ID"]);
      const active = !accessibleIds || (packageId ? accessibleIds.has(packageId) : false);
      if (active) result.packagesAccessible += 1;
      const input = rowToPackageInput(parsedRow.values, active, result.imported + 1);
      const outcome = await upsertDroptopPackage(input);
      if (outcome === "created") result.packagesCreated += 1;
      else result.packagesUpdated += 1;
      importedNames.push(input.name);
      result.imported += 1;
    } catch (error) {
      const importError = { rowNumber: parsedRow.rowNumber, message: error instanceof Error ? error.message : "Unable to import package row.", row: parsedRow.values };
      errors.push(importError);
      await addImportError(batchId, importError);
      result.failed += 1;
    }
  }

  result.duplicatesDeactivated = await deactivateLocalDuplicatePackages(importedNames);
  await finishImportBatch(batchId, {
    status: "completed",
    imported: result.imported,
    skipped: result.skipped,
    failed: result.failed,
    summary: result
  });

  return { batchId, rowsTotal: rows.length, errors, ...result };
}
