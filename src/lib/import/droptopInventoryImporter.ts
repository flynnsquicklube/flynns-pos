import { execute, query } from "../db/sqlite";
import { createId } from "../utils/ids";
import { nowIso } from "../utils/dates";
import { addImportError, createImportBatch, finishImportBatch } from "../db/repositories/importRepo";
import { cleanValue, parseDroptopCsv, parseMoney, parseNumber } from "./droptopCsvParser";
import type { ImportErrorInfo, InventoryImportResult, InventoryPreview, ParsedCsvRow } from "./importTypes";
import type { InventoryItem } from "../../types/inventory";

const inventoryHeaders = ["Product ID", "Product Type", "Inventory Type", "UPC", "Brand", "Suppliers"];

export function parseDroptopInventory(text: string): ParsedCsvRow[] {
  return parseDroptopCsv(text, inventoryHeaders);
}

function boolish(value: string | null | undefined): boolean {
  const cleaned = cleanValue(value)?.toLowerCase();
  return cleaned === "yes" || cleaned === "true" || cleaned === "1" || cleaned === "y";
}

function buildName(row: Record<string, string | null>): string {
  const productType = cleanValue(row["Product Type"]) ?? "Inventory Item";
  const brand = cleanValue(row.Brand);
  const viscosity = cleanValue(row.Viscosity);
  const formulation = cleanValue(row["Oil Formulation"]);
  if (productType.toLowerCase().includes("oil") && (brand || viscosity || formulation)) {
    return [brand, viscosity, formulation, productType].filter(Boolean).join(" ");
  }
  return [brand, productType].filter(Boolean).join(" ") || productType;
}

async function findInventory(row: Record<string, string | null>): Promise<InventoryItem | null> {
  const productId = cleanValue(row["Product ID"]);
  if (!productId) return null;
  const external = await query<InventoryItem>("SELECT * FROM inventory_items WHERE external_source = 'droptop' AND external_id = ? AND deleted_at IS NULL", [productId]);
  if (external[0]) return external[0];
  const fallback = await query<InventoryItem>("SELECT * FROM inventory_items WHERE (sku = ? OR product_id = ?) AND deleted_at IS NULL", [productId, productId]);
  return fallback[0] ?? null;
}

export async function previewDroptopInventory(text: string): Promise<InventoryPreview> {
  const rows = parseDroptopInventory(text);
  let existing = 0;
  for (const row of rows) {
    if (await findInventory(row.values)) existing += 1;
  }
  return {
    totalRows: rows.length,
    estimatedNewInventoryItems: rows.length - existing,
    estimatedUpdatedInventoryItems: existing,
    rowsPreview: rows.slice(0, 5),
    errors: []
  };
}

export async function importDroptopInventory(text: string, fileName: string): Promise<InventoryImportResult> {
  const rows = parseDroptopInventory(text);
  const batchId = await createImportBatch({ source: "droptop", fileName, importType: "inventory", rowsTotal: rows.length });
  const errors: ImportErrorInfo[] = [];
  const result = { imported: 0, skipped: 0, failed: 0, inventoryItemsCreated: 0, inventoryItemsUpdated: 0 };

  for (const parsedRow of rows) {
    try {
      const row = parsedRow.values;
      const productId = cleanValue(row["Product ID"]);
      if (!productId) throw new Error("Missing Product ID.");
      const timestamp = nowIso();
      const existing = await findInventory(row);
      const name = buildName(row);
      const active = boolish(row.Sellable) || boolish(row.Trackable) || boolish(row.Replenishable) ? 1 : 0;
      const values = [
        productId,
        productId,
        cleanValue(row["Product Type"]),
        cleanValue(row["Inventory Type"]),
        name,
        cleanValue(row["Inventory Type"]) ?? cleanValue(row["Product Type"]) ?? "Inventory",
        cleanValue(row.Brand) ?? cleanValue(row.Suppliers),
        parseMoney(row.Cost),
        parseMoney(row.Retail),
        parseNumber(row["Quantity On Hand"]) ?? 0,
        parseNumber(row.Min) ?? 0,
        cleanValue(row.UPC),
        active,
        cleanValue(row.Notes),
        cleanValue(row.Measurement),
        cleanValue(row.Viscosity),
        cleanValue(row["Oil Formulation"]),
        parseNumber(row["Qty. Sold (Last 30 Days)"]),
        parseMoney(row["Replacement Cost"]),
        parseMoney(row["Avg. Cost"]),
        parseNumber(row.Min),
        parseNumber(row.Max),
        cleanValue(row["Sequence ID"]),
        JSON.stringify(row),
        timestamp
      ];

      if (existing) {
        await execute(
          `UPDATE inventory_items SET
            sku = ?, product_id = ?, product_type = ?, inventory_type = ?, name = ?, category = ?,
            vendor = ?, cost = ?, retail_price = ?, quantity_on_hand = ?, reorder_point = ?,
            barcode = ?, active = ?, notes = ?, measurement = ?, viscosity = ?, oil_formulation = ?,
            quantity_sold_last_30_days = ?, replacement_cost = ?, avg_cost = ?, min_quantity = ?,
            max_quantity = ?, sequence_id = ?, original_import_json = ?, external_source = 'droptop',
            external_id = ?, is_imported = 1, updated_at = ?, sync_status = 'synced'
           WHERE id = ?`,
          [...values.slice(0, 24), productId, timestamp, existing.id]
        );
        result.inventoryItemsUpdated += 1;
      } else {
        await execute(
          `INSERT INTO inventory_items (
            id, sku, product_id, product_type, inventory_type, name, category, vendor,
            cost, retail_price, quantity_on_hand, reorder_point, barcode, active, notes,
            measurement, viscosity, oil_formulation, quantity_sold_last_30_days,
            replacement_cost, avg_cost, min_quantity, max_quantity, sequence_id,
            original_import_json, external_source, external_id, is_imported,
            created_at, updated_at, deleted_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'droptop', ?, 1, ?, ?, NULL, 'synced')`,
          [createId("inv"), ...values.slice(0, 24), productId, timestamp, timestamp]
        );
        result.inventoryItemsCreated += 1;
      }
      result.imported += 1;
    } catch (error) {
      const importError = { rowNumber: parsedRow.rowNumber, message: error instanceof Error ? error.message : "Unable to import inventory row.", row: parsedRow.values };
      errors.push(importError);
      await addImportError(batchId, importError);
      result.failed += 1;
    }
  }

  await finishImportBatch(batchId, {
    status: "completed",
    imported: result.imported,
    skipped: result.skipped,
    failed: result.failed,
    summary: result
  });

  return { batchId, rowsTotal: rows.length, errors, ...result };
}
