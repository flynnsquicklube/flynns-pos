export interface AppPathsInfo {
  appDataPath: string;
  userDataPath: string;
  databasePath: string | null;
}

export interface PlatformInfo {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface DatabaseBackupResult {
  ok: boolean;
  filePath?: string;
  fileName?: string;
  fileSizeBytes?: number;
  databaseSizeBytes?: number;
  error?: string;
}

export interface DiagnosticExportResult {
  ok: boolean;
  filePath?: string;
  fileName?: string;
  fileSizeBytes?: number;
  error?: string;
}
