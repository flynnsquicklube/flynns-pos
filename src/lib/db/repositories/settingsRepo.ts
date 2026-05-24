import { execute, getDatabaseInfo, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

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
