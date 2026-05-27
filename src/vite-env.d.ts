/// <reference types="vite/client" />

interface FlynnsDatabaseBridge {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: string }>;
  transaction?(statements: { sql: string; params?: unknown[] }[]): Promise<{ changes: number }>;
  info(): Promise<{ path: string; ready: boolean }>;
  getPath?(): Promise<string>;
}

interface FlynnsPOSBridge {
  isElectron: boolean;
  database: FlynnsDatabaseBridge;
  files?: {
    readText(filePath: string): Promise<string>;
  };
  app?: {
    getPaths(): Promise<{
      appDataPath: string;
      userDataPath: string;
      databasePath: string | null;
    }>;
    openPath(path: string): Promise<{ ok: boolean; error?: string }>;
    getPlatformInfo(): Promise<{
      appVersion: string;
      electronVersion: string;
      nodeVersion: string;
      platform: string;
      arch: string;
    }>;
  };
  backup?: {
    createDatabaseBackup(input: { defaultFileName: string }): Promise<{
      ok: boolean;
      filePath?: string;
      fileName?: string;
      fileSizeBytes?: number;
      databaseSizeBytes?: number;
      error?: string;
    }>;
    saveDiagnosticsJson(input: { defaultFileName: string; payload: unknown }): Promise<{
      ok: boolean;
      filePath?: string;
      fileName?: string;
      fileSizeBytes?: number;
      error?: string;
    }>;
  };
}

interface Window {
  flynnsPOS?: FlynnsPOSBridge;
  flynns?: {
    db: FlynnsDatabaseBridge;
  };
}
