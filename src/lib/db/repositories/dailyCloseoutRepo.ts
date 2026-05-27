import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso, todayIsoDate } from "../../utils/dates";
import { getCurrentEmployeeSnapshot } from "../../security/currentUser";
import { writeAuditLog } from "./auditLogRepo";

export interface DailyCloseout {
  id: string;
  business_date: string;
  status: "open" | "closed" | "reopened";
  opened_at: string;
  closed_at: string | null;
  closed_by_employee_id: string | null;
  gross_sales: number;
  net_sales: number;
  tax_collected: number;
  discount_total: number;
  cash_total: number;
  card_total: number;
  check_total: number;
  other_total: number;
  cash_counted: number | null;
  cash_over_short: number | null;
  completed_ticket_count: number;
  vehicle_count: number;
  notes: string | null;
  summary_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloseoutSummary {
  businessDate: string;
  grossSales: number;
  netSales: number;
  taxCollected: number;
  discountTotal: number;
  cashTotal: number;
  cardTotal: number;
  checkTotal: number;
  otherTotal: number;
  completedTicketCount: number;
  vehicleCount: number;
  openTicketCount: number;
  waitingPaymentCount: number;
}

export function getCurrentBusinessDate(): string {
  return todayIsoDate();
}

export async function calculateCloseoutSummary(date = getCurrentBusinessDate()): Promise<CloseoutSummary> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const [sales] = await query<{ grossSales: number; netSales: number; taxCollected: number; discountTotal: number; completedTicketCount: number; vehicleCount: number }>(
    `SELECT COALESCE(SUM(total), 0) AS grossSales,
      COALESCE(SUM(subtotal - discount_total), 0) AS netSales,
      COALESCE(SUM(tax_total), 0) AS taxCollected,
      COALESCE(SUM(discount_total), 0) AS discountTotal,
      COUNT(*) AS completedTicketCount,
      COUNT(DISTINCT vehicle_id) AS vehicleCount
     FROM tickets
     WHERE deleted_at IS NULL AND status = 'completed' AND COALESCE(completed_at, created_at) BETWEEN ? AND ?`,
    [start, end]
  );
  const paymentRows = await query<{ method: string; total: number }>(
    `SELECT LOWER(method) AS method, COALESCE(SUM(amount), 0) AS total
     FROM payments
     WHERE deleted_at IS NULL AND status = 'paid' AND paid_at BETWEEN ? AND ?
     GROUP BY LOWER(method)`,
    [start, end]
  );
  const [active] = await query<{ openTicketCount: number; waitingPaymentCount: number }>(
    `SELECT
      COALESCE(SUM(CASE WHEN status IN ('checked_in', 'in_service') THEN 1 ELSE 0 END), 0) AS openTicketCount,
      COALESCE(SUM(CASE WHEN status = 'waiting_payment' THEN 1 ELSE 0 END), 0) AS waitingPaymentCount
     FROM tickets WHERE deleted_at IS NULL`
  );
  const paymentTotal = (method: string) => paymentRows.find((row) => row.method === method)?.total ?? 0;
  return {
    businessDate: date,
    grossSales: sales?.grossSales ?? 0,
    netSales: sales?.netSales ?? 0,
    taxCollected: sales?.taxCollected ?? 0,
    discountTotal: sales?.discountTotal ?? 0,
    cashTotal: paymentTotal("cash"),
    cardTotal: paymentTotal("card"),
    checkTotal: paymentTotal("check"),
    otherTotal: paymentRows.filter((row) => !["cash", "card", "check"].includes(row.method)).reduce((sum, row) => sum + row.total, 0),
    completedTicketCount: sales?.completedTicketCount ?? 0,
    vehicleCount: sales?.vehicleCount ?? 0,
    openTicketCount: active?.openTicketCount ?? 0,
    waitingPaymentCount: active?.waitingPaymentCount ?? 0
  };
}

export async function getCloseoutForDate(date: string): Promise<DailyCloseout | null> {
  const rows = await query<DailyCloseout>("SELECT * FROM daily_closeouts WHERE business_date = ? ORDER BY created_at DESC LIMIT 1", [date]);
  return rows[0] ?? null;
}

export async function closeBusinessDay(input: { businessDate: string; cashCounted: number; notes?: string | null }): Promise<DailyCloseout> {
  const summary = await calculateCloseoutSummary(input.businessDate);
  const existing = await getCloseoutForDate(input.businessDate);
  const actor = getCurrentEmployeeSnapshot();
  const timestamp = nowIso();
  const overShort = input.cashCounted - summary.cashTotal;
  const values = [summary.grossSales, summary.netSales, summary.taxCollected, summary.discountTotal, summary.cashTotal, summary.cardTotal, summary.checkTotal, summary.otherTotal, input.cashCounted, overShort, summary.completedTicketCount, summary.vehicleCount, input.notes ?? null, JSON.stringify(summary), timestamp, actor.id];
  if (existing) {
    await execute(
      `UPDATE daily_closeouts SET status = 'closed', gross_sales = ?, net_sales = ?, tax_collected = ?, discount_total = ?,
        cash_total = ?, card_total = ?, check_total = ?, other_total = ?, cash_counted = ?, cash_over_short = ?,
        completed_ticket_count = ?, vehicle_count = ?, notes = ?, summary_json = ?, closed_at = ?, closed_by_employee_id = ?, updated_at = ?
       WHERE id = ?`,
      [...values, timestamp, existing.id]
    );
    await writeAuditLog({ action: "daily_closeout.closed", entity_type: "daily_closeout", entity_id: existing.id, summary: `Closed business day ${input.businessDate}`, after: summary });
    const updated = await getCloseoutForDate(input.businessDate);
    if (!updated) throw new Error("Closeout missing after update.");
    return updated;
  }
  const id = createId("closeout");
  await execute(
    `INSERT INTO daily_closeouts (
      id, business_date, status, opened_at, closed_at, closed_by_employee_id,
      gross_sales, net_sales, tax_collected, discount_total, cash_total, card_total, check_total, other_total,
      cash_counted, cash_over_short, completed_ticket_count, vehicle_count, notes, summary_json, created_at, updated_at
    ) VALUES (?, ?, 'closed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.businessDate, timestamp, timestamp, actor.id, summary.grossSales, summary.netSales, summary.taxCollected, summary.discountTotal, summary.cashTotal, summary.cardTotal, summary.checkTotal, summary.otherTotal, input.cashCounted, overShort, summary.completedTicketCount, summary.vehicleCount, input.notes ?? null, JSON.stringify(summary), timestamp, timestamp]
  );
  await writeAuditLog({ action: "daily_closeout.closed", entity_type: "daily_closeout", entity_id: id, summary: `Closed business day ${input.businessDate}`, after: summary });
  const closeout = await getCloseoutForDate(input.businessDate);
  if (!closeout) throw new Error("Closeout was not created.");
  return closeout;
}

export async function reopenBusinessDay(id: string): Promise<void> {
  await execute("UPDATE daily_closeouts SET status = 'reopened', updated_at = ? WHERE id = ?", [nowIso(), id]);
  await writeAuditLog({ action: "daily_closeout.reopened", entity_type: "daily_closeout", entity_id: id, summary: "Reopened business day" });
}

export async function listCloseouts(): Promise<DailyCloseout[]> {
  return query<DailyCloseout>("SELECT * FROM daily_closeouts ORDER BY business_date DESC LIMIT 60");
}
