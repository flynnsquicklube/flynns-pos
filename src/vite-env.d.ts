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
}

interface Window {
  flynnsPOS?: FlynnsPOSBridge;
  flynns?: {
    db: FlynnsDatabaseBridge;
  };
}
