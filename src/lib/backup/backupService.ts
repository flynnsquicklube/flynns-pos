import { createBackupHistory } from "../db/repositories/backupsRepo";
import { getLocalStatus, runDatabaseHealthCheck } from "../db/repositories/settingsRepo";
import { listBackupHistory } from "../db/repositories/backupsRepo";
import { listImportBatches } from "../db/repositories/importRepo";
import { getSyncQueueStats } from "../db/repositories/loyaltySyncQueueRepo";
import { getRecentAuditLogs } from "../db/repositories/auditLogRepo";
import { listLocalErrors, logLocalError } from "../logging/localErrorLogger";
import type { AppPathsInfo, DatabaseBackupResult, DiagnosticExportResult, PlatformInfo } from "./backupTypes";

function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 16).replace("T", "-").replace(":", "-");
  return `flynns-pos-backup-${stamp}.sqlite`;
}

function diagnosticFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 16).replace("T", "-").replace(":", "-");
  return `flynns-pos-diagnostics-${stamp}.json`;
}

function backupBridge() {
  return window.flynnsPOS?.backup;
}

function appBridge() {
  return window.flynnsPOS?.app;
}

export async function getAppPathsInfo(): Promise<AppPathsInfo | null> {
  return appBridge()?.getPaths() ?? null;
}

export async function getPlatformInfo(): Promise<PlatformInfo | null> {
  return appBridge()?.getPlatformInfo() ?? null;
}

export async function openAppDataFolder(): Promise<void> {
  const paths = await getAppPathsInfo();
  if (!paths?.userDataPath) throw new Error("App data path is not available.");
  await appBridge()?.openPath(paths.userDataPath);
}

export async function createManualBackup(): Promise<DatabaseBackupResult> {
  const bridge = backupBridge();
  if (!bridge) throw new Error("Backup tools are only available in the Electron desktop app.");
  const result = await bridge.createDatabaseBackup({ defaultFileName: backupFileName() });
  await createBackupHistory({
    backupType: "manual",
    filePath: result.filePath ?? "not-created",
    fileName: result.fileName ?? backupFileName(),
    fileSizeBytes: result.fileSizeBytes ?? null,
    databaseSizeBytes: result.databaseSizeBytes ?? null,
    status: result.ok ? "created" : "failed",
    errorMessage: result.error ?? null
  });
  if (!result.ok) await logLocalError("backup", new Error(result.error ?? "Backup failed"), result);
  return result;
}

export async function buildDiagnosticBundle(): Promise<Record<string, unknown>> {
  const [localStatus, health, backups, imports, syncStats, auditLogs, localErrors, paths, platform] = await Promise.all([
    getLocalStatus(),
    runDatabaseHealthCheck(),
    listBackupHistory(20),
    listImportBatches(),
    getSyncQueueStats().catch(() => null),
    getRecentAuditLogs(10).catch(() => []),
    listLocalErrors(10, true).catch(() => []),
    getAppPathsInfo(),
    getPlatformInfo()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    platform,
    paths: paths ? { ...paths, databasePath: paths.databasePath ? "[redacted-path-present]" : null } : null,
    localStatus: { ...localStatus, databasePath: localStatus.databasePath ? "[redacted-path-present]" : null },
    health,
    backupHistory: backups.map((backup) => ({
      backup_type: backup.backup_type,
      file_name: backup.file_name,
      file_size_bytes: backup.file_size_bytes,
      database_size_bytes: backup.database_size_bytes,
      status: backup.status,
      created_at: backup.created_at,
      error_message: backup.error_message
    })),
    importBatches: imports.map((batch) => ({
      source: batch.source,
      file_name: batch.file_name,
      import_type: batch.import_type,
      status: batch.status,
      rows_total: batch.rows_total,
      rows_imported: batch.rows_imported,
      rows_skipped: batch.rows_skipped,
      rows_failed: batch.rows_failed,
      started_at: batch.started_at,
      completed_at: batch.completed_at
    })),
    syncStats,
    recentAuditSummaries: auditLogs.map((entry) => ({
      action: entry.action,
      entity_type: entry.entity_type,
      summary: entry.summary,
      created_at: entry.created_at
    })),
    recentLocalErrors: localErrors.map((entry) => ({
      source: entry.source,
      message: entry.message,
      created_at: entry.created_at,
      resolved: Boolean(entry.resolved_at)
    }))
  };
}

export async function exportDiagnostics(): Promise<DiagnosticExportResult> {
  const bridge = backupBridge();
  if (!bridge) throw new Error("Diagnostic export is only available in the Electron desktop app.");
  try {
    const bundle = await buildDiagnosticBundle();
    const result = await bridge.saveDiagnosticsJson({ defaultFileName: diagnosticFileName(), payload: bundle });
    if (!result.ok) await logLocalError("diagnostics", new Error(result.error ?? "Diagnostic export failed"), result);
    return result;
  } catch (error) {
    await logLocalError("diagnostics", error);
    throw error;
  }
}
