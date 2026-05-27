import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

export type BackupType = "manual" | "automatic";
export type BackupStatus = "created" | "failed" | "restored";

export interface BackupHistoryEntry {
  id: string;
  backup_type: BackupType;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  database_size_bytes: number | null;
  status: BackupStatus;
  error_message: string | null;
  created_at: string;
  restored_at: string | null;
  restored_by_employee_id: string | null;
}

export async function createBackupHistory(input: {
  backupType: BackupType;
  filePath: string;
  fileName: string;
  fileSizeBytes?: number | null;
  databaseSizeBytes?: number | null;
  status: BackupStatus;
  errorMessage?: string | null;
}): Promise<BackupHistoryEntry> {
  const id = createId("backup");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO backup_history (
      id, backup_type, file_path, file_name, file_size_bytes, database_size_bytes,
      status, error_message, created_at, restored_at, restored_by_employee_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    [
      id,
      input.backupType,
      input.filePath,
      input.fileName,
      input.fileSizeBytes ?? null,
      input.databaseSizeBytes ?? null,
      input.status,
      input.errorMessage ?? null,
      timestamp
    ]
  );
  const rows = await query<BackupHistoryEntry>("SELECT * FROM backup_history WHERE id = ?", [id]);
  return rows[0];
}

export async function listBackupHistory(limit = 20): Promise<BackupHistoryEntry[]> {
  return query<BackupHistoryEntry>("SELECT * FROM backup_history ORDER BY created_at DESC LIMIT ?", [limit]);
}

export async function getLastSuccessfulBackup(): Promise<BackupHistoryEntry | null> {
  const rows = await query<BackupHistoryEntry>("SELECT * FROM backup_history WHERE status = 'created' ORDER BY created_at DESC LIMIT 1");
  return rows[0] ?? null;
}
