export interface DbBridge {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: string }>;
  transaction?(statements: { sql: string; params?: unknown[] }[]): Promise<{ changes: number }>;
  info(): Promise<{ path: string; ready: boolean }>;
  getPath?(): Promise<string>;
}

export interface ElectronBridgeDebug {
  isElectronBridgeDetected: boolean;
  databaseAvailable: boolean;
  userAgent: string;
  legacyBridgeDetected: boolean;
}

export function getElectronBridge(): FlynnsPOSBridge | null {
  if (window.flynnsPOS?.isElectron && window.flynnsPOS.database) return window.flynnsPOS;
  if (window.flynns?.db) {
    return {
      isElectron: true,
      database: window.flynns.db
    };
  }
  return null;
}

export function getElectronBridgeDebug(): ElectronBridgeDebug {
  const bridge = getElectronBridge();
  return {
    isElectronBridgeDetected: Boolean(bridge?.isElectron),
    databaseAvailable: Boolean(bridge?.database),
    userAgent: navigator.userAgent,
    legacyBridgeDetected: Boolean(window.flynns?.db)
  };
}

function missingBridgeMessage(): string {
  if (navigator.userAgent.includes("Electron")) {
    return "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences.";
  }
  return "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev.";
}

function getBridge(): DbBridge {
  const bridge = getElectronBridge();
  if (!bridge?.database) throw new Error(missingBridgeMessage());
  return bridge.database;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return getBridge().query<T>(sql, params);
}

export async function execute(sql: string, params: unknown[] = []) {
  return getBridge().execute(sql, params);
}

export async function getDatabaseInfo() {
  return getBridge().info();
}

export function isDesktopDatabaseAvailable(): boolean {
  return Boolean(getElectronBridge()?.database);
}
