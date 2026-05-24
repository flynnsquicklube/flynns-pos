import { query } from "../sqlite";
import { todayIsoDate } from "../../utils/dates";
import { getDashboardMetrics } from "./ticketsRepo";

export interface SalesSummary {
  grossSales: number;
  netSales: number;
  taxCollected: number;
  taxableSales: number;
  completedTickets: number;
}

export interface PaymentMethodTotal {
  method: string;
  total: number;
  count: number;
}

export interface ServiceSale {
  name: string;
  quantity: number;
  total: number;
}

export interface ItemTypeSale {
  itemType: string;
  total: number;
  quantity: number;
}

export interface PackageCount {
  packageName: string;
  count: number;
  total: number;
}

function dateClause(column: string, range: { dateFrom?: string; dateTo?: string }, params: unknown[]) {
  const clauses: string[] = [];
  if (range.dateFrom) {
    clauses.push(`${column} >= ?`);
    params.push(range.dateFrom);
  }
  if (range.dateTo) {
    clauses.push(`${column} <= ?`);
    params.push(range.dateTo);
  }
  return clauses;
}

export const getTodayDashboardMetrics = getDashboardMetrics;

export async function getSalesSummary(range: { dateFrom?: string; dateTo?: string } = {}): Promise<SalesSummary> {
  const params: unknown[] = [];
  const clauses = ["deleted_at IS NULL", "status = 'completed'", ...dateClause("completed_at", range, params)];
  const [row] = await query<SalesSummary>(
    `SELECT
      COALESCE(SUM(total), 0) AS grossSales,
      COALESCE(SUM(total - tax_total), 0) AS netSales,
      COALESCE(SUM(tax_total), 0) AS taxCollected,
      COALESCE(SUM(subtotal), 0) AS taxableSales,
      COUNT(*) AS completedTickets
     FROM tickets
     WHERE ${clauses.join(" AND ")}`,
    params
  );
  return row ?? { grossSales: 0, netSales: 0, taxCollected: 0, taxableSales: 0, completedTickets: 0 };
}

export async function getPaymentMethodTotals(range: { dateFrom?: string; dateTo?: string } = {}): Promise<PaymentMethodTotal[]> {
  const params: unknown[] = [];
  const clauses = ["deleted_at IS NULL", ...dateClause("paid_at", range, params)];
  return query<PaymentMethodTotal>(
    `SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM payments
     WHERE ${clauses.join(" AND ")}
     GROUP BY method
     ORDER BY total DESC`,
    params
  );
}

export async function getCarCount(range: { dateFrom?: string; dateTo?: string } = {}): Promise<number> {
  const summary = await getSalesSummary(range);
  return summary.completedTickets;
}

export async function getAverageTicket(range: { dateFrom?: string; dateTo?: string } = {}): Promise<number> {
  const summary = await getSalesSummary(range);
  return summary.completedTickets > 0 ? summary.grossSales / summary.completedTickets : 0;
}

export async function getServiceSales(range: { dateFrom?: string; dateTo?: string } = {}): Promise<ServiceSale[]> {
  const params: unknown[] = [];
  const clauses = ["t.deleted_at IS NULL", "t.status = 'completed'", "i.deleted_at IS NULL", ...dateClause("t.completed_at", range, params)];
  return query<ServiceSale>(
    `SELECT i.name, COALESCE(SUM(i.quantity), 0) AS quantity, COALESCE(SUM(i.line_total), 0) AS total
     FROM ticket_items i
     JOIN tickets t ON t.id = i.ticket_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY i.name
     ORDER BY total DESC`,
    params
  );
}

export async function getItemTypeSales(range: { dateFrom?: string; dateTo?: string } = {}): Promise<ItemTypeSale[]> {
  const params: unknown[] = [];
  const clauses = ["t.deleted_at IS NULL", "t.status = 'completed'", "i.deleted_at IS NULL", ...dateClause("t.completed_at", range, params)];
  return query<ItemTypeSale>(
    `SELECT COALESCE(i.item_type, 'service') AS itemType,
      COALESCE(SUM(i.line_total), 0) AS total,
      COALESCE(SUM(i.quantity), 0) AS quantity
     FROM ticket_items i
     JOIN tickets t ON t.id = i.ticket_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY COALESCE(i.item_type, 'service')
     ORDER BY total DESC`,
    params
  );
}

export async function getPackageCounts(range: { dateFrom?: string; dateTo?: string } = {}): Promise<PackageCount[]> {
  const params: unknown[] = [];
  const clauses = ["t.deleted_at IS NULL", "t.status = 'completed'", "d.deleted_at IS NULL", ...dateClause("t.completed_at", range, params)];
  return query<PackageCount>(
    `SELECT d.package_name AS packageName, COUNT(*) AS count, COALESCE(SUM(d.package_total), 0) AS total
     FROM ticket_package_details d
     JOIN tickets t ON t.id = d.ticket_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY d.package_name
     ORDER BY count DESC`,
    params
  );
}

export function todayRange() {
  const date = todayIsoDate();
  return { dateFrom: `${date}T00:00:00.000Z`, dateTo: `${date}T23:59:59.999Z` };
}
