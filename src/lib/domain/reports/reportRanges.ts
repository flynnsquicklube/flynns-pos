export type ReportRangeKey = "today" | "last7" | "month" | "all";

export function getReportRange(key: ReportRangeKey): { dateFrom?: string; dateTo?: string; label: string } {
  if (key === "all") return { label: "All Imported Data" };
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (key === "last7") start.setDate(start.getDate() - 6);
  if (key === "month") start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString(), label: key === "today" ? "Today" : key === "last7" ? "Last 7 Days" : "This Month" };
}

