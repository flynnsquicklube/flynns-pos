import type { AccountingExportProvider, DailyAccountingSummary } from "./accountingExport.types";

export class QuickBooksProvider implements AccountingExportProvider {
  async exportDailySummary(summary: DailyAccountingSummary): Promise<{ ok: boolean; message: string }> {
    void summary;
    return { ok: false, message: "QuickBooks Online export is not configured." };
  }
}
