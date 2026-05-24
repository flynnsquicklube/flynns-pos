import { FileDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  getAverageTicket,
  getItemTypeSales,
  getPackageCounts,
  getPaymentMethodTotals,
  getSalesSummary,
  getServiceSales,
  todayRange,
  type ItemTypeSale,
  type PackageCount,
  type PaymentMethodTotal,
  type SalesSummary,
  type ServiceSale
} from "../lib/db/repositories/reportsRepo";
import { formatMoney } from "../lib/utils/money";

const tabs = ["Summary", "Financials", "Customers / Fleets", "Staff"];
const zeroSummary: SalesSummary = { grossSales: 0, netSales: 0, taxCollected: 0, taxableSales: 0, completedTickets: 0 };

export function ReportsPage() {
  const [summary, setSummary] = useState<SalesSummary>(zeroSummary);
  const [averageTicket, setAverageTicket] = useState(0);
  const [payments, setPayments] = useState<PaymentMethodTotal[]>([]);
  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);
  const [itemTypeSales, setItemTypeSales] = useState<ItemTypeSale[]>([]);
  const [packageCounts, setPackageCounts] = useState<PackageCount[]>([]);

  useEffect(() => {
    const range = todayRange();
    Promise.all([getSalesSummary(range), getAverageTicket(range), getPaymentMethodTotals(range), getServiceSales(range), getItemTypeSales(range), getPackageCounts(range)])
      .then(([sales, average, paymentTotals, services, typeSales, packages]) => {
        setSummary(sales);
        setAverageTicket(average);
        setPayments(paymentTotals);
        setServiceSales(services);
        setItemTypeSales(typeSales);
        setPackageCounts(packages);
      })
      .catch(() => setSummary(zeroSummary));
  }, []);

  const sections = [
    { title: "Sales", cards: [["Finalized Orders", String(summary.completedTickets)], ["Vehicles", String(summary.completedTickets)], ["Net Sales", formatMoney(summary.netSales)], ["Gross Sales", formatMoney(summary.grossSales)], ["Average Order Value", formatMoney(averageTicket)]] },
    { title: "Payments", cards: payments.length ? payments.map((payment) => [payment.method, `${formatMoney(payment.total)} (${payment.count})`]) : [["Payments", formatMoney(0)], ["Refunded", formatMoney(0)]] },
    { title: "Taxes", cards: [["Tax Collected", formatMoney(summary.taxCollected)], ["Taxable Sales", formatMoney(summary.taxableSales)], ["Discounts", formatMoney(0)]] },
    { title: "Inventory", cards: [["Cost of Goods Sold", formatMoney(0)], ["COGS %", "0%"], ["Restocked", "0"]] },
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
          <button key={tab} className={`py-3 text-sm font-semibold ${index === 0 ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-500"}`}>{tab}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary">Today</Button>
        <Button variant="secondary">All Operations</Button>
        <Button variant="secondary">Separate by Operation</Button>
        <Button variant="secondary" disabled icon={<FileDown size={16} />}>PDF Soon</Button>
        <Button variant="secondary" disabled icon={<FileDown size={16} />}>CSV Soon</Button>
        <Button icon={<RefreshCw size={16} />}>Refresh Report</Button>
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
