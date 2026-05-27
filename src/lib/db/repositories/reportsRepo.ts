import { query } from "../sqlite";
import { todayIsoDate } from "../../utils/dates";
import { getDashboardMetrics } from "./ticketsRepo";
import { getReportRange, type ReportRangeKey } from "../../domain/reports/reportRanges";

export type DateRangeKey = ReportRangeKey;

export interface SalesSummary {
  grossSales: number;
  netSales: number;
  taxCollected: number;
  taxableSales: number;
  completedTickets: number;
  importedTickets: number;
  localTickets: number;
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

export interface OrderStatusSummary {
  completed: number;
  canceled: number;
  active: number;
}

export interface OutstandingBalanceSummary {
  unpaidTickets: number;
  partiallyPaidTickets: number;
  paidTickets: number;
  waitingPaymentAmount: number;
}

export interface CogsSummary {
  estimatedCogs: number;
  estimatedGrossProfit: number;
  estimatedGrossMarginPercent: number;
  inventoryBackedSales: number;
  filterSales: number;
  packageSales: number;
  addOnSales: number;
}

export interface LoyaltyReportSummary {
  couponsRedeemedCount: number;
  couponsRedeemedAmount: number;
  freeOilChangesRedeemed: number;
  referralCouponsIssued: number;
  activeCouponsCount: number;
  estimatedActiveCouponValue: number;
  freeOilChangeRewardsAvailable: number;
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

export function rangeForKey(key: DateRangeKey): { dateFrom?: string; dateTo?: string; label: string } {
  return getReportRange(key);
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
      COUNT(*) AS completedTickets,
      SUM(CASE WHEN is_imported = 1 THEN 1 ELSE 0 END) AS importedTickets,
      SUM(CASE WHEN COALESCE(is_imported, 0) = 0 THEN 1 ELSE 0 END) AS localTickets
     FROM tickets
     WHERE ${clauses.join(" AND ")}`,
    params
  );
  return row ?? { grossSales: 0, netSales: 0, taxCollected: 0, taxableSales: 0, completedTickets: 0, importedTickets: 0, localTickets: 0 };
}

export async function getPaymentMethodTotals(range: { dateFrom?: string; dateTo?: string } = {}): Promise<PaymentMethodTotal[]> {
  const params: unknown[] = [];
  const clauses = ["deleted_at IS NULL", "status = 'paid'", ...dateClause("paid_at", range, params)];
  return query<PaymentMethodTotal>(
    `SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM payments
     WHERE ${clauses.join(" AND ")}
     GROUP BY method
     ORDER BY total DESC`,
    params
  );
}

export async function getOutstandingBalances(range: { dateFrom?: string; dateTo?: string } = {}): Promise<OutstandingBalanceSummary> {
  const params: unknown[] = [];
  const clauses = ["deleted_at IS NULL", ...dateClause("COALESCE(completed_at, created_at)", range, params)];
  const [row] = await query<OutstandingBalanceSummary>(
    `SELECT
      COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END), 0) AS unpaidTickets,
      COALESCE(SUM(CASE WHEN payment_status IN ('partial', 'partially_paid') THEN 1 ELSE 0 END), 0) AS partiallyPaidTickets,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paidTickets,
      COALESCE(SUM(CASE WHEN status = 'waiting_payment' THEN total ELSE 0 END), 0) AS waitingPaymentAmount
     FROM tickets
     WHERE ${clauses.join(" AND ")}`,
    params
  );
  return row ?? { unpaidTickets: 0, partiallyPaidTickets: 0, paidTickets: 0, waitingPaymentAmount: 0 };
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

export async function getOrderStatusSummary(range: { dateFrom?: string; dateTo?: string } = {}): Promise<OrderStatusSummary> {
  const params: unknown[] = [];
  const clauses = ["deleted_at IS NULL", ...dateClause("COALESCE(completed_at, created_at)", range, params)];
  const [row] = await query<OrderStatusSummary>(
    `SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) AS canceled,
      SUM(CASE WHEN status IN ('checked_in', 'in_service', 'waiting_payment') THEN 1 ELSE 0 END) AS active
     FROM tickets
     WHERE ${clauses.join(" AND ")}`,
    params
  );
  return {
    completed: row?.completed ?? 0,
    canceled: row?.canceled ?? 0,
    active: row?.active ?? 0
  };
}

export async function getCogsSummary(range: { dateFrom?: string; dateTo?: string } = {}): Promise<CogsSummary> {
  const params: unknown[] = [];
  const clauses = ["t.deleted_at IS NULL", "t.status = 'completed'", "i.deleted_at IS NULL", ...dateClause("t.completed_at", range, params)];
  const [row] = await query<CogsSummary>(
    `SELECT
      COALESCE(SUM(CASE WHEN i.cost IS NOT NULL THEN i.cost * i.quantity ELSE 0 END), 0) AS estimatedCogs,
      COALESCE(SUM(i.line_total), 0) - COALESCE(SUM(CASE WHEN i.cost IS NOT NULL THEN i.cost * i.quantity ELSE 0 END), 0) AS estimatedGrossProfit,
      CASE
        WHEN COALESCE(SUM(i.line_total), 0) > 0
        THEN ((COALESCE(SUM(i.line_total), 0) - COALESCE(SUM(CASE WHEN i.cost IS NOT NULL THEN i.cost * i.quantity ELSE 0 END), 0)) / COALESCE(SUM(i.line_total), 0)) * 100
        ELSE 0
      END AS estimatedGrossMarginPercent,
      COALESCE(SUM(CASE WHEN i.inventory_item_id IS NOT NULL THEN i.line_total ELSE 0 END), 0) AS inventoryBackedSales,
      COALESCE(SUM(CASE WHEN i.inventory_item_id IS NOT NULL AND LOWER(i.name) LIKE '%filter%' THEN i.line_total ELSE 0 END), 0) AS filterSales,
      COALESCE(SUM(CASE WHEN i.item_type = 'package' THEN i.line_total ELSE 0 END), 0) AS packageSales,
      COALESCE(SUM(CASE WHEN COALESCE(i.item_type, 'service') NOT IN ('package', 'fee', 'discount') THEN i.line_total ELSE 0 END), 0) AS addOnSales
     FROM ticket_items i
     JOIN tickets t ON t.id = i.ticket_id
     WHERE ${clauses.join(" AND ")}`,
    params
  );
  return row ?? { estimatedCogs: 0, estimatedGrossProfit: 0, estimatedGrossMarginPercent: 0, inventoryBackedSales: 0, filterSales: 0, packageSales: 0, addOnSales: 0 };
}

export async function getLoyaltyReportSummary(range: { dateFrom?: string; dateTo?: string } = {}): Promise<LoyaltyReportSummary> {
  const redeemedParams: unknown[] = [];
  const redeemedClauses = ["status = 'redeemed'", ...dateClause("redeemed_at", range, redeemedParams)];
  const [redeemed] = await query<Pick<LoyaltyReportSummary, "couponsRedeemedCount" | "couponsRedeemedAmount" | "freeOilChangesRedeemed">>(
    `SELECT
      COUNT(*) AS couponsRedeemedCount,
      COALESCE(SUM(calculated_discount), 0) AS couponsRedeemedAmount,
      COALESCE(SUM(CASE WHEN discount_type = 'free_oil_change' THEN 1 ELSE 0 END), 0) AS freeOilChangesRedeemed
     FROM ticket_coupon_applications
     WHERE ${redeemedClauses.join(" AND ")}`,
    redeemedParams
  );
  const [active] = await query<Pick<LoyaltyReportSummary, "activeCouponsCount" | "estimatedActiveCouponValue">>(
    `SELECT COUNT(*) AS activeCouponsCount,
      COALESCE(SUM(CASE WHEN discount_type = 'fixed' THEN discount_amount ELSE 0 END), 0) AS estimatedActiveCouponValue
     FROM customer_coupons
     WHERE status = 'active'`
  );
  const [referrals] = await query<{ referralCouponsIssued: number }>("SELECT COUNT(*) AS referralCouponsIssued FROM customer_coupons WHERE source = 'referral'");
  const [rewards] = await query<{ freeOilChangeRewardsAvailable: number }>("SELECT COALESCE(SUM(free_rewards_available), 0) AS freeOilChangeRewardsAvailable FROM vehicle_punch_cards");
  return {
    couponsRedeemedCount: redeemed?.couponsRedeemedCount ?? 0,
    couponsRedeemedAmount: redeemed?.couponsRedeemedAmount ?? 0,
    freeOilChangesRedeemed: redeemed?.freeOilChangesRedeemed ?? 0,
    referralCouponsIssued: referrals?.referralCouponsIssued ?? 0,
    activeCouponsCount: active?.activeCouponsCount ?? 0,
    estimatedActiveCouponValue: active?.estimatedActiveCouponValue ?? 0,
    freeOilChangeRewardsAvailable: rewards?.freeOilChangeRewardsAvailable ?? 0
  };
}

export async function getInventoryRetailTotal(): Promise<number> {
  const [row] = await query<{ total: number }>(
    "SELECT COALESCE(SUM(quantity_on_hand * retail_price), 0) AS total FROM inventory_items WHERE deleted_at IS NULL"
  );
  return row?.total ?? 0;
}

export function todayRange() {
  const date = todayIsoDate();
  return { dateFrom: `${date}T00:00:00.000Z`, dateTo: `${date}T23:59:59.999Z`, label: "Today" };
}
