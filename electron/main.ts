import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import isDev from "electron-is-dev";
import Database from "better-sqlite3";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { columnMigrations, schemaStatements, seedCatalogItems, seedInventoryItems, seedServicePackages, seedServices } from "../src/lib/db/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;
let currentDbPath: string | null = null;

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
  currentDbPath = dbPath;
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const database = getDatabase();
  const getTableColumns = (tableName: string) => database.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  const columnExists = (tableName: string, columnName: string) => getTableColumns(tableName).some((existing) => existing.name === columnName);
  const addColumnIfMissing = (tableName: string, columnName: string, columnDefinition: string) => {
    if (!columnExists(tableName, columnName)) {
      console.info(`[SQLite migration] Adding ${tableName}.${columnName} ${columnDefinition}`);
      database.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
    }
  };
  const tableStatements = schemaStatements.filter((statement) => !statement.trim().toUpperCase().startsWith("CREATE INDEX"));
  const indexStatements = schemaStatements.filter((statement) => statement.trim().toUpperCase().startsWith("CREATE INDEX"));

  const migrate = database.transaction(() => {
    for (const statement of tableStatements) {
      database.prepare(statement).run();
    }

    for (const migration of columnMigrations) {
      addColumnIfMissing(migration.tableName, migration.columnName, migration.columnDefinition);
    }

    for (const statement of indexStatements) {
      database.prepare(statement).run();
    }

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
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.webContents.on("console-message", (_event, _level, message) => {
      console.log(`[renderer] ${message}`);
    });
  }

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  const dbPath = initializeDatabase();
  const getSafeOrigin = (url: string) => {
    try {
      return url.startsWith("file://") ? "file://" : new URL(url).origin;
    } catch {
      return "";
    }
  };
  const isAllowedAppOrigin = (origin: string) => origin === "file://" || origin === "http://127.0.0.1:5173" || origin === "http://localhost:5173";

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = getSafeOrigin(details.requestingUrl || webContents.getURL());
    if (permission === "media" && isAllowedAppOrigin(origin)) {
      console.log(`[permissions] media requested from ${origin}: allowed`);
      callback(true);
      return;
    }
    console.log(`[permissions] ${permission} requested from ${origin}: denied`);
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    if (permission === "media" && isAllowedAppOrigin(requestingOrigin)) return true;
    return false;
  });

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

  ipcMain.handle("db:transaction", (_event, statements: { sql: string; params?: unknown[] }[] = []) => {
    try {
      let changes = 0;
      const runTransaction = getDatabase().transaction(() => {
        for (const statement of statements) {
          const result = getDatabase().prepare(statement.sql).run(...(statement.params ?? []));
          changes += result.changes;
        }
      });
      runTransaction();
      return { changes };
    } catch (error) {
      console.error("SQLite transaction failed", error);
      throw error;
    }
  });

  ipcMain.handle("db:info", () => ({ path: dbPath, ready: true }));
  ipcMain.handle("db:getPath", () => dbPath);
  ipcMain.handle("file:readText", async (_event, filePath: string) => fs.readFile(filePath, "utf8"));
  ipcMain.handle("app:getPaths", () => ({
    appDataPath: app.getPath("appData"),
    userDataPath: app.getPath("userData"),
    databasePath: currentDbPath
  }));
  ipcMain.handle("app:getPlatformInfo", () => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch
  }));
  ipcMain.handle("shell:openPath", async (_event, targetPath: string) => {
    const error = await shell.openPath(targetPath);
    return error ? { ok: false, error } : { ok: true };
  });
  ipcMain.handle("backup:createDatabaseBackup", async (_event, input: { defaultFileName?: string }) => {
    try {
      if (!currentDbPath || !db) return { ok: false, error: "SQLite database path is not available." };
      db.pragma("wal_checkpoint(TRUNCATE)");
      const backupDialogOptions = {
        title: "Create Database Backup",
        defaultPath: path.join(app.getPath("documents"), input.defaultFileName ?? "flynns-pos-backup.sqlite"),
        filters: [{ name: "SQLite Database", extensions: ["sqlite"] }]
      };
      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, backupDialogOptions)
        : await dialog.showSaveDialog(backupDialogOptions);
      if (canceled || !filePath) return { ok: false, error: "Backup canceled." };
      await fs.copyFile(currentDbPath, filePath);
      const [backupStat, databaseStat] = await Promise.all([fs.stat(filePath), fs.stat(currentDbPath)]);
      return {
        ok: true,
        filePath,
        fileName: path.basename(filePath),
        fileSizeBytes: backupStat.size,
        databaseSizeBytes: databaseStat.size
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Backup failed." };
    }
  });
  ipcMain.handle("backup:saveDiagnosticsJson", async (_event, input: { defaultFileName?: string; payload: unknown }) => {
    try {
      const diagnosticsDialogOptions = {
        title: "Export Diagnostics",
        defaultPath: path.join(app.getPath("documents"), input.defaultFileName ?? "flynns-pos-diagnostics.json"),
        filters: [{ name: "JSON", extensions: ["json"] }]
      };
      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, diagnosticsDialogOptions)
        : await dialog.showSaveDialog(diagnosticsDialogOptions);
      if (canceled || !filePath) return { ok: false, error: "Diagnostic export canceled." };
      const json = JSON.stringify(input.payload, null, 2);
      await fs.writeFile(filePath, json, "utf8");
      const stat = await fs.stat(filePath);
      return { ok: true, filePath, fileName: path.basename(filePath), fileSizeBytes: stat.size };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Diagnostic export failed." };
    }
  });

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
  try {
    db?.close();
    db = null;
  } catch (error) {
    console.error("Failed to close SQLite database", error);
  }
});

app.on("before-quit", () => {
  db?.close();
  db = null;
});
