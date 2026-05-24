import { execute, getDatabaseInfo, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { columnMigrations } from "../schema";

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

export async function runDatabaseHealthCheck(): Promise<DatabaseHealthCheck> {
  const passed: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const requiredTables = [
    "customers",
    "vehicles",
    "tickets",
    "ticket_items",
    "payments",
    "service_history",
    "inventory_items",
    "service_packages",
    "service_catalog_items",
    "app_settings",
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

  const missingCustomerTickets = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND customer_id IS NULL");
  const missingVehicleTickets = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND vehicle_id IS NULL");
  const completedWithoutDate = await count("SELECT COUNT(*) AS count FROM tickets WHERE deleted_at IS NULL AND status = 'completed' AND completed_at IS NULL");
  const paidWithoutPayment = await count(`
    SELECT COUNT(*) AS count
    FROM tickets t
    WHERE t.deleted_at IS NULL
      AND t.payment_status IN ('paid', 'partial')
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

  if (missingCustomerTickets) warnings.push(`${missingCustomerTickets} ticket(s) do not have a customer link.`);
  if (missingVehicleTickets) warnings.push(`${missingVehicleTickets} ticket(s) do not have a vehicle link.`);
  if (completedWithoutDate) warnings.push(`${completedWithoutDate} completed ticket(s) are missing completed_at.`);
  if (paidWithoutPayment) warnings.push(`${paidWithoutPayment} paid/partial ticket(s) do not have payment records.`);
  if (brokenHistory) errors.push(`${brokenHistory} service history row(s) have broken ticket/customer/vehicle links.`);
  if (duplicateImportedTickets) errors.push(`${duplicateImportedTickets} duplicate imported Droptop ticket external ID(s) found.`);
  if (duplicateImportedInventory) errors.push(`${duplicateImportedInventory} duplicate imported Droptop inventory external ID(s) found.`);

  const counts = {
    importedTickets: await count("SELECT COUNT(*) AS count FROM tickets WHERE external_source = 'droptop'"),
    importedCustomers: await count("SELECT COUNT(*) AS count FROM customers WHERE external_source = 'droptop'"),
    importedVehicles: await count("SELECT COUNT(*) AS count FROM vehicles WHERE external_source = 'droptop'"),
    importedInventory: await count("SELECT COUNT(*) AS count FROM inventory_items WHERE external_source = 'droptop'")
  };

  if (!warnings.length && !errors.length) {
    passed.push("Relational integrity checks passed.");
  }

  return { passed, warnings, errors, counts };
}
