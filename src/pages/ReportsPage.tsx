import { FileDown, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  getAverageTicket,
  getInventoryRetailTotal,
  getItemTypeSales,
  getOrderStatusSummary,
  getPackageCounts,
  getPaymentMethodTotals,
  getSalesSummary,
  getServiceSales,
  rangeForKey,
  type DateRangeKey,
  type ItemTypeSale,
  type OrderStatusSummary,
  type PackageCount,
  type PaymentMethodTotal,
  type SalesSummary,
  type ServiceSale
} from "../lib/db/repositories/reportsRepo";
import { formatMoney } from "../lib/utils/money";

const tabs = ["Summary", "Financials", "Customers / Fleets", "Staff"];
const zeroSummary: SalesSummary = { grossSales: 0, netSales: 0, taxCollected: 0, taxableSales: 0, completedTickets: 0, importedTickets: 0, localTickets: 0 };
const zeroStatusSummary: OrderStatusSummary = { completed: 0, canceled: 0, active: 0 };

export function ReportsPage() {
  const [summary, setSummary] = useState<SalesSummary>(zeroSummary);
  const [averageTicket, setAverageTicket] = useState(0);
  const [payments, setPayments] = useState<PaymentMethodTotal[]>([]);
  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);
  const [itemTypeSales, setItemTypeSales] = useState<ItemTypeSale[]>([]);
  const [packageCounts, setPackageCounts] = useState<PackageCount[]>([]);
  const [statusSummary, setStatusSummary] = useState<OrderStatusSummary>(zeroStatusSummary);
  const [inventoryRetail, setInventoryRetail] = useState(0);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");

  const loadReports = useCallback(() => {
    const range = rangeForKey(rangeKey);
    Promise.all([getSalesSummary(range), getAverageTicket(range), getPaymentMethodTotals(range), getServiceSales(range), getItemTypeSales(range), getPackageCounts(range), getOrderStatusSummary(range), getInventoryRetailTotal()])
      .then(([sales, average, paymentTotals, services, typeSales, packages, orderStatuses, inventoryTotal]) => {
        setSummary(sales);
        setAverageTicket(average);
        setPayments(paymentTotals);
        setServiceSales(services);
        setItemTypeSales(typeSales);
        setPackageCounts(packages);
        setStatusSummary(orderStatuses);
        setInventoryRetail(inventoryTotal);
      })
      .catch(() => {
        setSummary(zeroSummary);
        setStatusSummary(zeroStatusSummary);
        setInventoryRetail(0);
      });
  }, [rangeKey]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const sections = [
    { title: "Sales", cards: [["Finalized Orders", String(summary.completedTickets)], ["Canceled Orders", String(statusSummary.canceled)], ["Active Orders", String(statusSummary.active)], ["Vehicles", String(summary.completedTickets)], ["Net Sales", formatMoney(summary.netSales)], ["Gross Sales", formatMoney(summary.grossSales)], ["Average Order Value", formatMoney(averageTicket)], ["Imported Orders", String(summary.importedTickets)], ["Local Orders", String(summary.localTickets)]] },
    { title: "Payments", cards: payments.length ? payments.map((payment) => [payment.method, `${formatMoney(payment.total)} (${payment.count})`]) : [["Payments", formatMoney(0)]] },
    { title: "Taxes", cards: [["Tax Collected", formatMoney(summary.taxCollected)], ["Taxable Sales", formatMoney(summary.taxableSales)], ["Discounts", formatMoney(0)]] },
    { title: "Inventory", cards: [["Inventory Retail Value", formatMoney(inventoryRetail)]] },
    { title: "Packages", cards: packageCounts.length ? packageCounts.slice(0, 4).map((item) => [item.packageName, `${item.count} / ${formatMoney(item.total)}`]) : [["Package Sales", "0"]] },
    { title: "Sales by Type", cards: itemTypeSales.length ? itemTypeSales.map((item) => [item.itemType, `${formatMoney(item.total)} (${item.quantity})`]) : [["Package Sales", formatMoney(0)], ["Add-ons", formatMoney(0)], ["Fees", formatMoney(0)], ["Discounts", formatMoney(0)]] },
    { title: "Services", cards: serviceSales.length ? serviceSales.slice(0, 4).map((service) => [service.name, `${formatMoney(service.total)} (${service.quantity})`]) : [["Services Sold", "0"]] }
  ];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Reports</h1>
        <p className="text-sm text-slate-500">Sales, vehicles, taxes, and shop performance.</p>
      </div>
      <div className="flex gap-6 border-b border-slate-200">
        {tabs.map((tab, index) => (
          <button key={tab} disabled={index !== 0} className={`py-3 text-sm font-semibold ${index === 0 ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-400"}`}>{index === 0 ? tab : `${tab} Coming Soon`}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {(["today", "last7", "month", "all"] as DateRangeKey[]).map((key) => <Button key={key} variant={rangeKey === key ? "primary" : "secondary"} onClick={() => setRangeKey(key)}>{rangeForKey(key).label}</Button>)}
        <Button variant="secondary" disabled>Custom Range Coming Soon</Button>
        <Button variant="secondary" disabled>Separate by Operation Coming Soon</Button>
        <Button variant="secondary" disabled icon={<FileDown size={16} />}>PDF Soon</Button>
        <Button variant="secondary" disabled icon={<FileDown size={16} />}>CSV Soon</Button>
        <Button icon={<RefreshCw size={16} />} onClick={loadReports}>Refresh Report</Button>
      </div>
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-lg font-bold text-slate-950">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {section.cards.map(([label, value]) => (
              <Card key={label} className="p-5">
                <div className="text-sm font-semibold text-slate-500">{label}</div>
                <div className="mt-3 text-2xl font-bold text-slate-950">{value}</div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
