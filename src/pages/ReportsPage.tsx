import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { MetricCard } from "../components/ui/MetricCard";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionCard } from "../components/ui/SectionCard";
import { getCurrentEmployee } from "../lib/security/currentUser";
import { hasPermission } from "../lib/security/permissions";
import {
  getAverageTicket,
  getCogsSummary,
  getInventoryRetailTotal,
  getItemTypeSales,
  getLoyaltyReportSummary,
  getOrderStatusSummary,
  getOutstandingBalances,
  getPackageCounts,
  getPaymentMethodTotals,
  getSalesSummary,
  getServiceSales,
  rangeForKey,
  type DateRangeKey,
  type CogsSummary,
  type ItemTypeSale,
  type OrderStatusSummary,
  type OutstandingBalanceSummary,
  type PackageCount,
  type PaymentMethodTotal,
  type SalesSummary,
  type ServiceSale,
  type LoyaltyReportSummary
} from "../lib/db/repositories/reportsRepo";
import { formatMoney } from "../lib/utils/money";

const zeroSummary: SalesSummary = { grossSales: 0, netSales: 0, taxCollected: 0, taxableSales: 0, completedTickets: 0, importedTickets: 0, localTickets: 0 };
const zeroStatusSummary: OrderStatusSummary = { completed: 0, canceled: 0, active: 0 };
const zeroCogs: CogsSummary = { estimatedCogs: 0, estimatedGrossProfit: 0, estimatedGrossMarginPercent: 0, inventoryBackedSales: 0, filterSales: 0, packageSales: 0, addOnSales: 0 };
const zeroOutstanding: OutstandingBalanceSummary = { unpaidTickets: 0, partiallyPaidTickets: 0, paidTickets: 0, waitingPaymentAmount: 0 };
const zeroLoyalty: LoyaltyReportSummary = { couponsRedeemedCount: 0, couponsRedeemedAmount: 0, freeOilChangesRedeemed: 0, referralCouponsIssued: 0, activeCouponsCount: 0, estimatedActiveCouponValue: 0, freeOilChangeRewardsAvailable: 0 };

export function ReportsPage() {
  const [summary, setSummary] = useState<SalesSummary>(zeroSummary);
  const [averageTicket, setAverageTicket] = useState(0);
  const [payments, setPayments] = useState<PaymentMethodTotal[]>([]);
  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);
  const [itemTypeSales, setItemTypeSales] = useState<ItemTypeSale[]>([]);
  const [packageCounts, setPackageCounts] = useState<PackageCount[]>([]);
  const [statusSummary, setStatusSummary] = useState<OrderStatusSummary>(zeroStatusSummary);
  const [inventoryRetail, setInventoryRetail] = useState(0);
  const [cogs, setCogs] = useState<CogsSummary>(zeroCogs);
  const [outstanding, setOutstanding] = useState<OutstandingBalanceSummary>(zeroOutstanding);
  const [loyalty, setLoyalty] = useState<LoyaltyReportSummary>(zeroLoyalty);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");
  const [allowed, setAllowed] = useState(true);

  const loadReports = useCallback(() => {
    const range = rangeForKey(rangeKey);
    Promise.all([getSalesSummary(range), getAverageTicket(range), getPaymentMethodTotals(range), getServiceSales(range), getItemTypeSales(range), getPackageCounts(range), getOrderStatusSummary(range), getInventoryRetailTotal(), getCogsSummary(range), getOutstandingBalances(range), getLoyaltyReportSummary(range)])
      .then(([sales, average, paymentTotals, services, typeSales, packages, orderStatuses, inventoryTotal, cogsSummary, outstandingSummary, loyaltySummary]) => {
        setSummary(sales);
        setAverageTicket(average);
        setPayments(paymentTotals);
        setServiceSales(services);
        setItemTypeSales(typeSales);
        setPackageCounts(packages);
        setStatusSummary(orderStatuses);
        setInventoryRetail(inventoryTotal);
        setCogs(cogsSummary);
        setOutstanding(outstandingSummary);
        setLoyalty(loyaltySummary);
      })
      .catch(() => {
        setSummary(zeroSummary);
        setStatusSummary(zeroStatusSummary);
        setInventoryRetail(0);
        setCogs(zeroCogs);
        setOutstanding(zeroOutstanding);
        setLoyalty(zeroLoyalty);
      });
  }, [rangeKey]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    getCurrentEmployee().then((employee) => setAllowed(hasPermission(employee.role, "admin.analytics_view"))).catch(() => setAllowed(true));
  }, []);

  const sections = [
    { title: "Sales Detail", cards: [["Finalized Orders", String(summary.completedTickets)], ["Canceled Orders", String(statusSummary.canceled)], ["Active Orders", String(statusSummary.active)], ["Vehicles", String(summary.completedTickets)], ["Imported Orders", String(summary.importedTickets)], ["Local Orders", String(summary.localTickets)]] },
    { title: "Payments", cards: payments.length ? payments.map((payment) => [payment.method, `${formatMoney(payment.total)} (${payment.count})`]) : [["Payments", formatMoney(0)]] },
    { title: "Payment Status", cards: [["Paid Tickets", String(outstanding.paidTickets)], ["Unpaid Tickets", String(outstanding.unpaidTickets)], ["Partially Paid", String(outstanding.partiallyPaidTickets)], ["Waiting Payment Amount", formatMoney(outstanding.waitingPaymentAmount)]] },
    { title: "Taxes", cards: [["Tax Collected", formatMoney(summary.taxCollected)], ["Taxable Sales", formatMoney(summary.taxableSales)], ["Discounts", formatMoney(0)]] },
    { title: "Rewards & Coupons", cards: [["Coupons Redeemed", String(loyalty.couponsRedeemedCount)], ["Coupon Discounts", formatMoney(loyalty.couponsRedeemedAmount)], ["Free Oil Changes Redeemed", String(loyalty.freeOilChangesRedeemed)], ["Referral Coupons Issued", String(loyalty.referralCouponsIssued)], ["Active Coupons", String(loyalty.activeCouponsCount)], ["Active Coupon Liability", formatMoney(loyalty.estimatedActiveCouponValue)], ["Free Oil Rewards Available", String(loyalty.freeOilChangeRewardsAvailable)]] },
    { title: "Inventory", cards: [["Inventory Retail Value", formatMoney(inventoryRetail)], ["Inventory-Backed Sales", formatMoney(cogs.inventoryBackedSales)], ["Filter Sales", formatMoney(cogs.filterSales)]] },
    { title: "COGS Estimate", cards: [["Estimated COGS", formatMoney(cogs.estimatedCogs)], ["Estimated Gross Profit", formatMoney(cogs.estimatedGrossProfit)], ["Gross Margin Estimate", `${Number(cogs.estimatedGrossMarginPercent || 0).toFixed(1)}%`], ["Package Sales", formatMoney(cogs.packageSales)], ["Add-On Sales", formatMoney(cogs.addOnSales)]] },
    { title: "Packages", cards: packageCounts.length ? packageCounts.slice(0, 4).map((item) => [item.packageName, `${item.count} / ${formatMoney(item.total)}`]) : [["Package Sales", "0"]] },
    { title: "Sales by Type", cards: itemTypeSales.length ? itemTypeSales.map((item) => [item.itemType, `${formatMoney(item.total)} (${item.quantity})`]) : [["Package Sales", formatMoney(0)], ["Add-ons", formatMoney(0)], ["Fees", formatMoney(0)], ["Discounts", formatMoney(0)]] },
    { title: "Services", cards: serviceSales.length ? serviceSales.slice(0, 4).map((service) => [service.name, `${formatMoney(service.total)} (${service.quantity})`]) : [["Services Sold", "0"]] }
  ];

  return (
    <section className="space-y-5">
      <PageHeader title="Admin" subtitle="Business performance, financial reporting, inventory value, and closeout analytics." />
      {!allowed ? <EmptyState title="Manager permission required" message="Financial analytics are visible to owner and manager roles only." /> : null}
      {allowed ? <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue Today" value={formatMoney(summary.grossSales)} detail="Gross sales for selected range" />
        <MetricCard label="Net Sales" value={formatMoney(summary.netSales)} detail="After discounts" />
        <MetricCard label="Average Ticket" value={formatMoney(averageTicket)} detail={`${summary.completedTickets} completed tickets`} />
        <MetricCard label="Inventory Value" value={formatMoney(inventoryRetail)} detail="Estimated retail value" />
      </div>
      <div className="flex flex-wrap gap-3 rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-white p-3 shadow-[var(--pos-shadow-card)]">
        {(["today", "last7", "month", "all"] as DateRangeKey[]).map((key) => <Button key={key} variant={rangeKey === key ? "primary" : "secondary"} onClick={() => setRangeKey(key)}>{rangeForKey(key).label}</Button>)}
        <Button icon={<RefreshCw size={16} />} onClick={loadReports}>Refresh Report</Button>
      </div>
      {sections.map((section) => (
        <SectionCard key={section.title} title={section.title}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {section.cards.map(([label, value]) => (
              <Card key={label} className="p-4 shadow-none">
                <div className="text-sm font-semibold text-[var(--pos-muted)]">{label}</div>
                <div className="mt-3 text-2xl font-bold text-[var(--pos-text)]">{value}</div>
              </Card>
            ))}
          </div>
        </SectionCard>
      ))}
      </> : null}
    </section>
  );
}
