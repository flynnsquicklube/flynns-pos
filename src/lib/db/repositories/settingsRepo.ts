import { execute, getDatabaseInfo, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { columnMigrations, schemaStatements } from "../schema";

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface LocalStatus {
  databasePath: string | null;
  databaseReady: boolean;
  syncQueueCount: number;
}

export interface DatabaseHealthCheck {
  passed: string[];
  warnings: string[];
  errors: string[];
  counts: {
    customers: number;
    vehicles: number;
    tickets: number;
    payments: number;
    serviceHistory: number;
    inventory: number;
    completedTickets: number;
    coupons: number;
    punchCards: number;
    importedTickets: number;
    importedCustomers: number;
    importedVehicles: number;
    importedInventory: number;
  };
}

export async function getSetting(key: string): Promise<AppSetting | null> {
  const rows = await query<AppSetting>("SELECT * FROM app_settings WHERE key = ?", [key]);
  return rows[0] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await getSetting(key);
  const timestamp = nowIso();
  if (existing) {
    await execute("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?", [value, timestamp, key]);
    return;
  }
  await execute("INSERT INTO app_settings (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [
    createId("setting"),
    key,
    value,
    timestamp,
    timestamp
  ]);
}

export async function listSettings(): Promise<AppSetting[]> {
  return query<AppSetting>("SELECT * FROM app_settings ORDER BY key ASC");
}

export async function getLocalStatus(): Promise<LocalStatus> {
  const info = await getDatabaseInfo();
  const [syncQueue] = await query<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue WHERE status != 'done'");
  return {
    databasePath: info.path,
    databaseReady: info.ready,
    syncQueueCount: syncQueue?.count ?? 0
  };
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const [row] = await query<{ count: number }>(sql, params);
  return row?.count ?? 0;
}

async function tableExists(tableName: string): Promise<boolean> {
  return (await count("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName])) > 0;
}

async function tableColumns(tableName: string): Promise<string[]> {
  const rows = await query<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
}

async function indexExists(indexName: string): Promise<boolean> {
  return (await count("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = ?", [indexName])) > 0;
}

export async function runDatabaseHealthCheck(): Promise<DatabaseHealthCheck> {
  const passed: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const requiredTables = [
    "customers",
    "employees",
    "vehicles",
    "tickets",
    "ticket_items",
    "payments",
    "service_history",
    "inventory_items",
    "service_packages",
    "service_catalog_items",
    "ticket_package_details",
    "window_stickers",
    "print_jobs",
    "audit_log",
    "daily_closeouts",
    "inventory_movements",
    "vin_decode_cache",
    "loyalty_sync_queue",
    "vehicle_punch_cards",
    "vehicle_punch_events",
    "referral_rewards",
    "customer_coupons",
    "ticket_coupon_applications",
    "app_settings",
    "sync_queue",
    "import_batches",
    "import_errors"
  ];

  for (const tableName of requiredTables) {
    if (await tableExists(tableName)) {
      passed.push(`Table exists: ${tableName}`);
    } else {
      errors.push(`Missing required table: ${tableName}`);
    }
  }

  const migrationsByTable = columnMigrations.reduce<Record<string, string[]>>((acc, migration) => {
    acc[migration.tableName] = [...(acc[migration.tableName] ?? []), migration.columnName];
    return acc;
  }, {});

  for (const [tableName, columns] of Object.entries(migrationsByTable)) {
    if (!(await tableExists(tableName))) continue;
    const existingColumns = await tableColumns(tableName);
    for (const columnName of columns) {
      if (existingColumns.includes(columnName)) {
        passed.push(`Column exists: ${tableName}.${columnName}`);
      } else {
        errors.push(`Missing required column: ${tableName}.${columnName}`);
      }
    }
  }

  for (const statement of schemaStatements.filter((item) => item.trim().toUpperCase().startsWith("CREATE INDEX"))) {
    const match = statement.match(/INDEX IF NOT EXISTS\s+([^\s]+)/i);
    const indexName = match?.[1];
    if (!indexName) continue;
    if (await indexExists(indexName)) passed.push(`Index exists: ${indexName}`);
    else warnings.push(`Index missing or not yet created: ${indexName}`);
  }

  const missingCustomerTickets = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND customer_id IS NULL");
  const missingVehicleTickets = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND vehicle_id IS NULL");
  const completedWithoutDate = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND status = 'completed' AND completed_at IS NULL");
  const paidWithoutPayment = await count(`
    SELECT COUNT(*) AS count
    FROM tickets t
    WHERE t.deleted_at IS NULL
      AND t.payment_status IN ('paid', 'partial', 'partially_paid')
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.ticket_id = t.id AND p.deleted_at IS NULL)
  `);
  const brokenHistory = await count(`
    SELECT COUNT(*) AS count
    FROM service_history h
    LEFT JOIN tickets t ON t.id = h.ticket_id
    LEFT JOIN customers c ON c.id = h.customer_id
    LEFT JOIN vehicles v ON v.id = h.vehicle_id
    WHERE h.deleted_at IS NULL AND (t.id IS NULL OR c.id IS NULL OR v.id IS NULL)
  `);
  const duplicateImportedTickets = await count(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT external_id
      FROM tickets
      WHERE external_source = 'droptop' AND external_id IS NOT NULL
      GROUP BY external_id
      HAVING COUNT(*) > 1
    )
  `);
  const duplicateImportedInventory = await count(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT external_id
      FROM inventory_items
      WHERE external_source = 'droptop' AND external_id IS NOT NULL
      GROUP BY external_id
      HAVING COUNT(*) > 1
    )
  `);
  const negativeInventory = await count("SELECT COUNT(*) AS count FROM inventory_items WHERE deleted_at IS NULL AND quantity_on_hand < 0");
  const retailBelowCost = await count("SELECT COUNT(*) AS count FROM inventory_items WHERE deleted_at IS NULL AND retail_price > 0 AND cost > 0 AND retail_price < cost");
  const oldActiveTickets = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND status IN ('checked_in', 'in_service', 'waiting_payment') AND datetime(created_at) < datetime('now', '-7 days')");
  const failedSyncEvents = await count("SELECT COUNT(*) AS count FROM loyalty_sync_queue WHERE status = 'failed'");
  const failedPrintJobs = await count("SELECT COUNT(*) AS count FROM print_jobs WHERE status = 'failed'");

  if (missingCustomerTickets) warnings.push(`${missingCustomerTickets} ticket(s) do not have a customer link.`);
  if (missingVehicleTickets) warnings.push(`${missingVehicleTickets} ticket(s) do not have a vehicle link.`);
  if (completedWithoutDate) warnings.push(`${completedWithoutDate} completed ticket(s) are missing completed_at.`);
  if (paidWithoutPayment) warnings.push(`${paidWithoutPayment} paid/partial ticket(s) do not have payment records.`);
  if (brokenHistory) errors.push(`${brokenHistory} service history row(s) have broken ticket/customer/vehicle links.`);
  if (duplicateImportedTickets) errors.push(`${duplicateImportedTickets} duplicate imported Droptop ticket external ID(s) found.`);
  if (duplicateImportedInventory) errors.push(`${duplicateImportedInventory} duplicate imported Droptop inventory external ID(s) found.`);
  if (negativeInventory) warnings.push(`${negativeInventory} inventory item(s) have negative quantity.`);
  if (retailBelowCost) warnings.push(`${retailBelowCost} inventory item(s) have retail price below cost.`);
  if (oldActiveTickets) warnings.push(`${oldActiveTickets} active ticket(s) are older than 7 days.`);
  if (failedSyncEvents) warnings.push(`${failedSyncEvents} loyalty sync event(s) are failed.`);
  if (failedPrintJobs) warnings.push(`${failedPrintJobs} print job(s) are failed.`);

  const counts = {
    customers: await count("SELECT COUNT(*) AS count FROM customers WHERE deleted_at IS NULL"),
    vehicles: await count("SELECT COUNT(*) AS count FROM vehicles WHERE deleted_at IS NULL"),
    tickets: await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL"),
    payments: await count("SELECT COUNT(*) AS count FROM payments WHERE deleted_at IS NULL"),
    serviceHistory: await count("SELECT COUNT(*) AS count FROM service_history WHERE deleted_at IS NULL"),
    inventory: await count("SELECT COUNT(*) AS count FROM inventory_items WHERE deleted_at IS NULL"),
    completedTickets: await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND status = 'completed'"),
    coupons: await count("SELECT COUNT(*) AS count FROM customer_coupons"),
    punchCards: await count("SELECT COUNT(*) AS count FROM vehicle_punch_cards"),
    importedTickets: await count("SELECT COUNT(*) AS count FROM tickets WHERE external_source = 'droptop'"),
    importedCustomers: await count("SELECT COUNT(*) AS count FROM customers WHERE external_source = 'droptop'"),
    importedVehicles: await count("SELECT COUNT(*) AS count FROM vehicles WHERE external_source = 'droptop'"),
    importedInventory: await count("SELECT COUNT(*) AS count FROM inventory_items WHERE external_source = 'droptop'")
  };

  passed.push(`Customer rows counted: ${counts.customers}`);
  passed.push(`Vehicle rows counted: ${counts.vehicles}`);
  passed.push(`Ticket rows counted: ${counts.tickets}`);
  passed.push(`Payment rows counted: ${counts.payments}`);
  passed.push(`Service history rows counted: ${counts.serviceHistory}`);
  passed.push(`Inventory rows counted: ${counts.inventory}`);

  if (!warnings.length && !errors.length) {
    passed.push("Relational integrity checks passed.");
  }

  return { passed, warnings, errors, counts };
}
