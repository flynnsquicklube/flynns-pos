export interface DbBridge {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: string }>;
  info(): Promise<{ path: string; ready: boolean }>;
}

declare global {
  interface Window {
    flynns?: {
      db: DbBridge;
    };
  }
}

function getBridge(): DbBridge {
  if (!window.flynns?.db) {
    throw new Error("Local SQLite is available in the Electron desktop app. Start with npm run electron:dev.");
  }
  return window.flynns.db;
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
  return Boolean(window.flynns?.db);
}
