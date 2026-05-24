import { app, BrowserWindow, ipcMain } from "electron";
import isDev from "electron-is-dev";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schemaStatements, seedCatalogItems, seedInventoryItems, seedServicePackages, seedServices } from "../src/lib/db/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

function nowIso() {
  return new Date().toISOString();
}

function getDatabase() {
  if (!db) {
    throw new Error("SQLite database has not been initialized.");
  }
  return db;
}

function initializeDatabase() {
  const dbPath = path.join(app.getPath("userData"), "flynns-pos.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const database = getDatabase();
  const ensureColumn = (table: string, column: string, definition: string) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((existing) => existing.name === column)) {
      database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  };

  const migrate = database.transaction(() => {
    for (const statement of schemaStatements) {
      database.prepare(statement).run();
    }

    ensureColumn("tickets", "customer_concern", "TEXT NULL");
    ensureColumn("tickets", "technician_notes", "TEXT NULL");
    ensureColumn("tickets", "internal_notes", "TEXT NULL");
    ensureColumn("tickets", "bay", "TEXT NULL");
    ensureColumn("tickets", "completed_at", "TEXT NULL");
    ensureColumn("tickets", "payment_status", "TEXT NOT NULL DEFAULT 'unpaid'");
    ensureColumn("tickets", "external_source", "TEXT NULL");
    ensureColumn("tickets", "external_id", "TEXT NULL");
    ensureColumn("tickets", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("tickets", "original_import_json", "TEXT NULL");
    ensureColumn("tickets", "imported_at", "TEXT NULL");
    ensureColumn("ticket_items", "item_type", "TEXT NULL");
    ensureColumn("ticket_items", "package_id", "TEXT NULL");
    ensureColumn("ticket_items", "inventory_item_id", "TEXT NULL");
    ensureColumn("ticket_items", "external_source", "TEXT NULL");
    ensureColumn("ticket_items", "external_id", "TEXT NULL");
    ensureColumn("ticket_items", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("ticket_items", "original_import_json", "TEXT NULL");
    ensureColumn("payments", "paid_at", "TEXT NULL");
    ensureColumn("payments", "external_source", "TEXT NULL");
    ensureColumn("payments", "external_id", "TEXT NULL");
    ensureColumn("payments", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("customers", "external_source", "TEXT NULL");
    ensureColumn("customers", "external_id", "TEXT NULL");
    ensureColumn("customers", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("vehicles", "external_source", "TEXT NULL");
    ensureColumn("vehicles", "external_id", "TEXT NULL");
    ensureColumn("vehicles", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("vehicles", "sub_model", "TEXT NULL");
    ensureColumn("service_history", "external_source", "TEXT NULL");
    ensureColumn("service_history", "external_id", "TEXT NULL");
    ensureColumn("service_history", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("inventory_items", "external_source", "TEXT NULL");
    ensureColumn("inventory_items", "external_id", "TEXT NULL");
    ensureColumn("inventory_items", "is_imported", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn("inventory_items", "product_id", "TEXT NULL");
    ensureColumn("inventory_items", "product_type", "TEXT NULL");
    ensureColumn("inventory_items", "inventory_type", "TEXT NULL");
    ensureColumn("inventory_items", "measurement", "TEXT NULL");
    ensureColumn("inventory_items", "viscosity", "TEXT NULL");
    ensureColumn("inventory_items", "oil_formulation", "TEXT NULL");
    ensureColumn("inventory_items", "quantity_sold_last_30_days", "REAL NULL");
    ensureColumn("inventory_items", "replacement_cost", "REAL NULL");
    ensureColumn("inventory_items", "avg_cost", "REAL NULL");
    ensureColumn("inventory_items", "min_quantity", "REAL NULL");
    ensureColumn("inventory_items", "max_quantity", "REAL NULL");
    ensureColumn("inventory_items", "sequence_id", "TEXT NULL");
    ensureColumn("inventory_items", "original_import_json", "TEXT NULL");

    const seeded = database
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get("seed_services_v1") as { value: string } | undefined;

    if (!seeded) {
      const insertService = database.prepare(`
        INSERT OR IGNORE INTO services (
          id, name, category, description, base_price, taxable, active, is_oil_change,
          sort_order, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?, ?, ?, NULL, 'synced')
      `);
      seedServices.forEach((service, index) => {
        insertService.run(service[0], service[1], service[2], service[3], service[4], service[5], index + 1, nowIso(), nowIso());
      });
      database.prepare("INSERT INTO app_settings (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
        "setting_seed_services_v1",
        "seed_services_v1",
        "true",
        nowIso(),
        nowIso()
      );
    }

    const inventoryCount = database.prepare("SELECT COUNT(*) as count FROM inventory_items WHERE deleted_at IS NULL").get() as { count: number };
    if (inventoryCount.count === 0) {
      const insertInventory = database.prepare(`
        INSERT OR IGNORE INTO inventory_items (
          id, sku, name, category, vendor, cost, retail_price, quantity_on_hand,
          reorder_point, barcode, active, notes, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, NULL, 'synced')
      `);
      seedInventoryItems.forEach((item) => {
        insertInventory.run(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], nowIso(), nowIso());
      });
    }

    const insertPackage = database.prepare(`
      INSERT OR IGNORE INTO service_packages (
        id, name, description, category, base_price, oil_brand, oil_type, included_quarts,
        extra_quart_price, included_filter_type, cartridge_filter_extra_fee,
        max_included_filter_cost, taxable, active, sort_order, created_at, updated_at,
        deleted_at, sync_status
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 1, ?, ?, ?, NULL, 'synced')
    `);
    seedServicePackages.forEach((servicePackage) => {
      insertPackage.run(
        servicePackage[0],
        servicePackage[1],
        servicePackage[2],
        servicePackage[3],
        servicePackage[4],
        servicePackage[5],
        servicePackage[6],
        servicePackage[7],
        servicePackage[8],
        servicePackage[9],
        servicePackage[10],
        nowIso(),
        nowIso()
      );
    });

    const insertCatalogItem = database.prepare(`
      INSERT OR IGNORE INTO service_catalog_items (
        id, name, category, description, sku, base_price, cost, taxable, active,
        is_oil_change, is_fee, is_discount, inventory_item_id, sort_order,
        created_at, updated_at, deleted_at, sync_status
      ) VALUES (?, ?, ?, NULL, NULL, ?, NULL, 1, 1, 0, ?, ?, NULL, ?, ?, ?, NULL, 'synced')
    `);
    seedCatalogItems.forEach((item) => {
      insertCatalogItem.run(item[0], item[1], item[2], item[3], item[4], item[5], item[6], nowIso(), nowIso());
    });
  });

  migrate();
  return dbPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    title: "Flynn's Quick Lube POS",
    backgroundColor: "#090d12",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  const dbPath = initializeDatabase();

  ipcMain.handle("db:query", (_event, sql: string, params: unknown[] = []) => {
    try {
      const statement = getDatabase().prepare(sql);
      return statement.all(...params);
    } catch (error) {
      console.error("SQLite query failed", error);
      throw error;
    }
  });

  ipcMain.handle("db:execute", (_event, sql: string, params: unknown[] = []) => {
    try {
      const result = getDatabase().prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowid: String(result.lastInsertRowid) };
    } catch (error) {
      console.error("SQLite execute failed", error);
      throw error;
    }
  });

  ipcMain.handle("db:info", () => ({ path: dbPath, ready: true }));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  db?.close();
  db = null;
});
