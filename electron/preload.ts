import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("flynns", {
  db: {
    query: <T>(sql: string, params: unknown[] = []) => ipcRenderer.invoke("db:query", sql, params) as Promise<T[]>,
    execute: (sql: string, params: unknown[] = []) =>
      ipcRenderer.invoke("db:execute", sql, params) as Promise<{ changes: number; lastInsertRowid: string }>,
    info: () => ipcRenderer.invoke("db:info") as Promise<{ path: string; ready: boolean }>
  }
});
