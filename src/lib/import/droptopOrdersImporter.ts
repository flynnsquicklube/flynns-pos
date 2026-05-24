import { execute, query } from "../db/sqlite";
import { createId } from "../utils/ids";
import { nowIso } from "../utils/dates";
import { addImportError, createImportBatch, finishImportBatch } from "../db/repositories/importRepo";
import { cleanValue, normalizePhone, normalizeText, parseDateTime, parseDroptopCsv, parseMileage, parseMoney, splitList } from "./droptopCsvParser";
import type { ImportErrorInfo, OrdersImportResult, OrdersPreview, ParsedCsvRow } from "./importTypes";
import type { Customer } from "../../types/customer";
import type { Vehicle } from "../../types/vehicle";
import type { ServicePackage } from "../../types/servicePackage";

const orderHeaders = ["Order ID", "Order Start Date", "Order Start Time", "Order Timezone", "Order Amount", "Order Status"];

function nameParts(name: string | null): { first: string; last: string } {
  const parts = cleanValue(name)?.split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { first: "Imported", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function mapStatus(status: string | null): "checked_in" | "in_service" | "completed" | "canceled" {
  const normalized = normalizeText(status);
  if (normalized.includes("cancel")) return "canceled";
  if (normalized.includes("final") || normalized.includes("complete")) return "completed";
  if (normalized.includes("progress")) return "in_service";
  return "checked_in";
}

function mapPaymentMethod(value: string | null): "Cash" | "Card" | "Check" | "Other" {
  const normalized = normalizeText(value);
  if (normalized.includes("cash")) return "Cash";
  if (normalized.includes("check")) return "Check";
  if (normalized.includes("credit") || normalized.includes("card")) return "Card";
  return "Other";
}

function deriveOilType(packages: string[]): string | null {
  const joined = normalizeText(packages.join(" "));
  if (joined.includes("diesel")) return "Diesel";
  if (joined.includes("mobil 1")) return "Mobil 1 Full Synthetic";
  if (joined.includes("full syn") || joined.includes("full synthetic")) return "Full Synthetic";
  if (joined.includes("synthetic blend")) return "Synthetic Blend";
  return null;
}

function parseInventoryLine(line: string): { name: string; quantity: number } {
  const match = line.match(/^(.*?)\s*\(([\d.]+)\s+[A-Za-z]+\)$/);
  if (!match) return { name: line, quantity: 1 };
  return { name: cleanValue(match[1]) ?? line, quantity: Number(match[2]) || 1 };
}

async function findCustomer(row: Record<string, string | null>): Promise<Customer | null> {
  const externalId = cleanValue(row["Customer ID"]);
  if (externalId) {
    const rows = await query<Customer>("SELECT * FROM customers WHERE external_source = 'droptop' AND external_id = ? AND deleted_at IS NULL", [externalId]);
    if (rows[0]) return rows[0];
  }
  const phone = normalizePhone(row["Customer Phone Number"]);
  if (phone) {
    const rows = await query<Customer>("SELECT * FROM customers WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, '-', ''), '(', ''), ')', ''), ' ', '') LIKE ? AND deleted_at IS NULL", [`%${phone.slice(-7)}%`]);
    if (rows[0]) return rows[0];
  }
  const customerName = normalizeText(row.Customer);
  if (customerName) {
    const rows = await query<Customer>("SELECT * FROM customers WHERE LOWER(TRIM(first_name || ' ' || last_name)) = ? AND deleted_at IS NULL", [customerName]);
    if (rows[0]) return rows[0];
  }
  return null;
}

async function upsertCustomer(row: Record<string, string | null>, timestamp: string): Promise<{ customer: Customer; created: boolean }> {
  const existing = await findCustomer(row);
  if (existing) return { customer: existing, created: false };
  const parts = nameParts(row.Customer);
  const id = createId("cust");
  await execute(
    `INSERT INTO customers (
      id, first_name, last_name, phone, email, notes, firebase_uid, referral_code,
      external_source, external_id, is_imported, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'droptop', ?, 1, ?, ?, NULL, 'synced')`,
    [id, parts.first, parts.last, cleanValue(row["Customer Phone Number"]) ?? "", cleanValue(row["Customer Email"]), null, cleanValue(row["Customer ID"]), timestamp, timestamp]
  );
  const rows = await query<Customer>("SELECT * FROM customers WHERE id = ?", [id]);
  return { customer: rows[0], created: true };
}

async function findVehicle(row: Record<string, string | null>): Promise<Vehicle | null> {
  const vin = cleanValue(row.VIN);
  if (vin) {
    const rows = await query<Vehicle>("SELECT * FROM vehicles WHERE vin = ? AND deleted_at IS NULL", [vin]);
    if (rows[0]) return rows[0];
  }
  const plate = cleanValue(row.License);
  const state = cleanValue(row["Plate Region"]);
  if (plate && state) {
    const rows = await query<Vehicle>("SELECT * FROM vehicles WHERE plate = ? AND plate_state = ? AND deleted_at IS NULL", [plate, state]);
    if (rows[0]) return rows[0];
  }
  return null;
}

async function upsertVehicle(row: Record<string, string | null>, customerId: string, orderId: string, timestamp: string): Promise<{ vehicle: Vehicle; created: boolean }> {
  const existing = await findVehicle(row);
  if (existing) return { vehicle: existing, created: false };
  const id = createId("veh");
  const subModel = cleanValue(row["Vehicle Sub Model"]);
  const notes = [subModel ? `Sub model: ${subModel}` : null, cleanValue(row["Other Vehicle"])].filter(Boolean).join(" | ") || null;
  const externalId = cleanValue(row.VIN) ?? `${orderId}-${cleanValue(row.License) ?? "vehicle"}`;
  await execute(
    `INSERT INTO vehicles (
      id, customer_id, vin, plate, plate_state, year, make, model, mileage, oil_type,
      notes, sub_model, external_source, external_id, is_imported,
      created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'droptop', ?, 1, ?, ?, NULL, 'synced')`,
    [
      id,
      customerId,
      cleanValue(row.VIN),
      cleanValue(row.License),
      cleanValue(row["Plate Region"]),
      parseMileage(row["Vehicle Year"]),
      cleanValue(row["Vehicle Make"]),
      cleanValue(row["Vehicle Model"]),
      parseMileage(row.Mileage),
      deriveOilType(splitList(row.Packages)),
      notes,
      subModel,
      externalId,
      timestamp,
      timestamp
    ]
  );
  const rows = await query<Vehicle>("SELECT * FROM vehicles WHERE id = ?", [id]);
  return { vehicle: rows[0], created: true };
}

async function packageIdByName(name: string): Promise<string | null> {
  const packages = await query<ServicePackage>("SELECT * FROM service_packages WHERE deleted_at IS NULL");
  const normalized = normalizeText(name).replace("duramax full syn", "full synthetic oil change");
  return packages.find((item) => normalizeText(item.name) === normalized || normalized.includes(normalizeText(item.name).replace(" oil change", "")))?.id ?? null;
}

export function parseDroptopOrders(text: string): ParsedCsvRow[] {
  return parseDroptopCsv(text, orderHeaders);
}

export async function previewDroptopOrders(text: string): Promise<OrdersPreview> {
  const rows = parseDroptopOrders(text);
  let duplicateTickets = 0;
  const customerKeys = new Set<string>();
  const vehicleKeys = new Set<string>();
  for (const row of rows) {
    const orderId = cleanValue(row.values["Order ID"]);
    if (!orderId) continue;
    const existing = await query<{ id: string }>("SELECT id FROM tickets WHERE external_source = 'droptop' AND external_id = ? AND deleted_at IS NULL", [orderId]);
    if (existing.length) duplicateTickets += 1;
    customerKeys.add(cleanValue(row.values["Customer ID"]) ?? normalizePhone(row.values["Customer Phone Number"]) ?? normalizeText(row.values.Customer));
    vehicleKeys.add(cleanValue(row.values.VIN) ?? `${cleanValue(row.values.License) ?? ""}-${cleanValue(row.values["Plate Region"]) ?? ""}`);
  }
  return {
    totalRows: rows.length,
    estimatedNewCustomers: customerKeys.size,
    estimatedNewVehicles: vehicleKeys.size,
    estimatedNewTickets: rows.length - duplicateTickets,
    estimatedSkippedDuplicateTickets: duplicateTickets,
    rowsPreview: rows.slice(0, 5),
    errors: []
  };
}

export async function importDroptopOrders(text: string, fileName: string): Promise<OrdersImportResult> {
  const rows = parseDroptopOrders(text);
  const batchId = await createImportBatch({ source: "droptop", fileName, importType: "orders", rowsTotal: rows.length });
  const errors: ImportErrorInfo[] = [];
  const result = { imported: 0, skipped: 0, failed: 0, customersCreated: 0, vehiclesCreated: 0, ticketsCreated: 0, paymentsCreated: 0, serviceHistoryCreated: 0 };

  for (const parsedRow of rows) {
    try {
      const row = parsedRow.values;
      const orderId = cleanValue(row["Order ID"]);
      if (!orderId) throw new Error("Missing Order ID.");
      const duplicate = await query<{ id: string }>("SELECT id FROM tickets WHERE external_source = 'droptop' AND external_id = ? AND deleted_at IS NULL", [orderId]);
      if (duplicate.length) {
        result.skipped += 1;
        continue;
      }
      const timestamp = parseDateTime(row["Order Start Date"], row["Order Start Time"]);
      const importedAt = nowIso();
      const { customer, created: customerCreated } = await upsertCustomer(row, timestamp);
      const { vehicle, created: vehicleCreated } = await upsertVehicle(row, customer.id, orderId, timestamp);
      if (customerCreated) result.customersCreated += 1;
      if (vehicleCreated) result.vehiclesCreated += 1;

      const packages = splitList(row.Packages);
      const services = splitList(row.Services);
      const inventoryItems = splitList(row["Inventory Items"]);
      const casualItems = [...splitList(row["Package Casual Items"]), ...splitList(row["Casual Items"])];
      const status = mapStatus(row["Order Status"]);
      const amount = parseMoney(row["Order Amount"]);
      const tax = parseMoney(row["Total Sales Tax"]);
      const subtotal = Math.max(amount - tax, 0);
      const ticketId = createId("tkt");
      await execute(
        `INSERT INTO tickets (
          id, customer_id, vehicle_id, status, subtotal, discount_total, tax_total, fee_total,
          total, payment_status, notes, customer_concern, technician_notes, internal_notes, bay,
          created_at, updated_at, completed_at, external_source, external_id, is_imported,
          original_import_json, imported_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, 'droptop', ?, 1, ?, ?, NULL, 'synced')`,
        [
          ticketId,
          customer.id,
          vehicle.id,
          status,
          subtotal,
          tax,
          amount,
          status === "completed" && cleanValue(row.Payments) ? "paid" : "unpaid",
          cleanValue(row.Notes),
          cleanValue(row["Bay Name"]),
          timestamp,
          importedAt,
          status === "completed" ? timestamp : null,
          orderId,
          JSON.stringify(row),
          importedAt
        ]
      );
      result.ticketsCreated += 1;

      const itemRows: { name: string; itemType: string; quantity: number; unitPrice: number; packageId: string | null }[] = [];
      for (const packageName of packages) {
        itemRows.push({ name: packageName, itemType: "package", quantity: 1, unitPrice: packages.length === 1 ? subtotal : 0, packageId: await packageIdByName(packageName) });
      }
      services.forEach((name) => itemRows.push({ name, itemType: "service", quantity: 1, unitPrice: 0, packageId: null }));
      inventoryItems.forEach((line) => {
        const parsed = parseInventoryLine(line);
        itemRows.push({ name: parsed.name, itemType: "inventory", quantity: parsed.quantity, unitPrice: 0, packageId: null });
      });
      casualItems.forEach((name) => itemRows.push({ name, itemType: "custom", quantity: 1, unitPrice: 0, packageId: null }));
      for (const [index, item] of itemRows.entries()) {
        await execute(
          `INSERT INTO ticket_items (
            id, ticket_id, service_id, item_type, package_id, inventory_item_id, name,
            quantity, unit_price, line_total, taxable, external_source, external_id,
            is_imported, original_import_json, created_at, updated_at, deleted_at, sync_status
          ) VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, 1, 'droptop', ?, 1, ?, ?, ?, NULL, 'synced')`,
          [
            createId("item"),
            ticketId,
            item.itemType,
            item.packageId,
            item.name,
            item.quantity,
            item.unitPrice,
            Math.round(item.quantity * item.unitPrice * 100) / 100,
            `${orderId}-item-${index}`,
            JSON.stringify(row),
            timestamp,
            importedAt
          ]
        );
      }

      if (cleanValue(row.Payments)) {
        const method = mapPaymentMethod(row.Payments);
        await execute(
          `INSERT INTO payments (
            id, ticket_id, amount, method, status, reference, paid_at, external_source,
            external_id, is_imported, created_at, updated_at, deleted_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'droptop', ?, 1, ?, ?, NULL, 'synced')`,
          [createId("pay"), ticketId, amount, method, status === "completed" ? "paid" : "recorded", timestamp, `${orderId}-${method}`, timestamp, importedAt]
        );
        result.paymentsCreated += 1;
      }

      if (status === "completed") {
        await execute(
          `INSERT INTO service_history (
            id, ticket_id, customer_id, vehicle_id, service_date, mileage, oil_type,
            services_json, notes, external_source, external_id, is_imported,
            created_at, updated_at, deleted_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'droptop', ?, 1, ?, ?, NULL, 'synced')`,
          [
            createId("hist"),
            ticketId,
            customer.id,
            vehicle.id,
            timestamp,
            parseMileage(row.Mileage) ?? 0,
            deriveOilType(packages),
            JSON.stringify({ packages, services, inventoryItems, casualItems }),
            cleanValue(row.Notes),
            orderId,
            timestamp,
            importedAt
          ]
        );
        result.serviceHistoryCreated += 1;
      }
      result.imported += 1;
    } catch (error) {
      const importError = { rowNumber: parsedRow.rowNumber, message: error instanceof Error ? error.message : "Unable to import order row.", row: parsedRow.values };
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
