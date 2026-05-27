import { contextBridge, ipcRenderer } from "electron";

const database = {
  query: <T,>(sql: string, params: unknown[] = []) => ipcRenderer.invoke("db:query", sql, params) as Promise<T[]>,
  execute: (sql: string, params: unknown[] = []) =>
    ipcRenderer.invoke("db:execute", sql, params) as Promise<{ changes: number; lastInsertRowid: string }>,
  transaction: (statements: { sql: string; params?: unknown[] }[]) => ipcRenderer.invoke("db:transaction", statements) as Promise<{ changes: number }>,
  info: () => ipcRenderer.invoke("db:info") as Promise<{ path: string; ready: boolean }>,
  getPath: () => ipcRenderer.invoke("db:getPath") as Promise<string>
};

const files = {
  readText: (filePath: string) => ipcRenderer.invoke("file:readText", filePath) as Promise<string>
};

const appTools = {
  getPaths: () => ipcRenderer.invoke("app:getPaths") as Promise<{ appDataPath: string; userDataPath: string; databasePath: string | null }>,
  openPath: (targetPath: string) => ipcRenderer.invoke("shell:openPath", targetPath) as Promise<{ ok: boolean; error?: string }>,
  getPlatformInfo: () => ipcRenderer.invoke("app:getPlatformInfo") as Promise<{ appVersion: string; electronVersion: string; nodeVersion: string; platform: string; arch: string }>
};

const backup = {
  createDatabaseBackup: (input: { defaultFileName: string }) =>
    ipcRenderer.invoke("backup:createDatabaseBackup", input) as Promise<{ ok: boolean; filePath?: string; fileName?: string; fileSizeBytes?: number; databaseSizeBytes?: number; error?: string }>,
  saveDiagnosticsJson: (input: { defaultFileName: string; payload: unknown }) =>
    ipcRenderer.invoke("backup:saveDiagnosticsJson", input) as Promise<{ ok: boolean; filePath?: string; fileName?: string; fileSizeBytes?: number; error?: string }>
};

const bridge = {
  isElectron: true,
  database,
  files,
  app: appTools,
  backup
};

if (process.env.NODE_ENV !== "production") {
  console.log("[preload] Flynn's POS bridge loaded");
}

contextBridge.exposeInMainWorld("flynnsPOS", bridge);
contextBridge.exposeInMainWorld("flynns", {
  db: database
});
