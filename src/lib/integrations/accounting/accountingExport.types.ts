export interface DailyAccountingSummary { date: string; grossSales: number; taxCollected: number; paymentTotals: Record<string, number>; }
export interface AccountingExportProvider { exportDailySummary(summary: DailyAccountingSummary): Promise<{ ok: boolean; message: string }>; }

