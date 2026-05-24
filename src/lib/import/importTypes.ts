export type ImportType = "orders" | "inventory";
export type ImportStatus = "previewed" | "running" | "completed" | "failed";

export interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string | null>;
}

export interface ImportErrorInfo {
  rowNumber: number | null;
  message: string;
  row?: Record<string, unknown>;
}

export interface ImportBatch {
  id: string;
  source: string;
  file_name: string;
  import_type: ImportType;
  status: ImportStatus;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  rows_failed: number;
  summary_json: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportErrorRow {
  id: string;
  batch_id: string;
  row_number: number | null;
  message: string;
  row_json: string | null;
  created_at: string;
}

export interface ImportHistoryEntry extends ImportBatch {
  errors: ImportErrorRow[];
}

export interface OrdersPreview {
  totalRows: number;
  estimatedNewCustomers: number;
  estimatedNewVehicles: number;
  estimatedNewTickets: number;
  estimatedSkippedDuplicateTickets: number;
  rowsPreview: ParsedCsvRow[];
  errors: ImportErrorInfo[];
}

export interface InventoryPreview {
  totalRows: number;
  estimatedNewInventoryItems: number;
  estimatedUpdatedInventoryItems: number;
  rowsPreview: ParsedCsvRow[];
  errors: ImportErrorInfo[];
}

export interface OrdersImportResult {
  batchId: string;
  rowsTotal: number;
  imported: number;
  skipped: number;
  failed: number;
  customersCreated: number;
  vehiclesCreated: number;
  ticketsCreated: number;
  paymentsCreated: number;
  serviceHistoryCreated: number;
  errors: ImportErrorInfo[];
}

export interface InventoryImportResult {
  batchId: string;
  rowsTotal: number;
  imported: number;
  skipped: number;
  failed: number;
  inventoryItemsCreated: number;
  inventoryItemsUpdated: number;
  errors: ImportErrorInfo[];
}
