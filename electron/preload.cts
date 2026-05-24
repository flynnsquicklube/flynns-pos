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

const bridge = {
  isElectron: true,
  database,
  files
};

if (process.env.NODE_ENV !== "production") {
  console.log("[preload] Flynn's POS bridge loaded");
}

contextBridge.exposeInMainWorld("flynnsPOS", bridge);
contextBridge.exposeInMainWorld("flynns", {
  db: database
});
