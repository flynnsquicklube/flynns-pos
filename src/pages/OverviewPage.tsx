import { Activity, CarFront, Clock3, DollarSign } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { PosMetricCard } from "../components/pos";
import { useEffect, useMemo, useState } from "react";
import { getTodayDashboardMetrics, type DashboardMetrics } from "../lib/db/repositories/ticketsRepo";
import { getPackageCounts, getPaymentMethodTotals, rangeForKey, type DateRangeKey, type PackageCount, type PaymentMethodTotal } from "../lib/db/repositories/reportsRepo";
import { formatMoney } from "../lib/utils/money";

const emptyMetrics: DashboardMetrics = { todaySales: 0, netSales: 0, carCount: 0, averageTicket: 0, openTickets: 0, lowInventory: 0, vehicleCountToday: 0, unpaidCompleted: 0, waitingPayment: 0, inService: 0, completedToday: 0, partialPaid: 0 };

export function OverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [packageCounts, setPackageCounts] = useState<PackageCount[]>([]);
  const [payments, setPayments] = useState<PaymentMethodTotal[]>([]);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("today");
  useEffect(() => {
    const range = rangeForKey(rangeKey);
    getTodayDashboardMetrics(range).then(setMetrics).catch(() => setMetrics(emptyMetrics));
    getPackageCounts(range).then(setPackageCounts).catch(() => setPackageCounts([]));
    getPaymentMethodTotals(range).then(setPayments).catch(() => setPayments([]));
  }, [rangeKey]);
  const range = rangeForKey(rangeKey);
  const kpis = useMemo(() => [
    { label: "Avg Order Value", value: formatMoney(metrics.averageTicket), icon: DollarSign },
    { label: "Gross Sales", value: formatMoney(metrics.todaySales), icon: Activity },
    { label: "Net Sales", value: formatMoney(metrics.netSales), icon: DollarSign },
    { label: "Active Tickets", value: String(metrics.openTickets), icon: Clock3 },
    { label: "Vehicles", value: String(metrics.vehicleCountToday), icon: CarFront }
  ], [metrics]);
  const statusCards = [
    ["Checked In / Open", metrics.openTickets],
    ["In Service", metrics.inService],
    ["Waiting Payment", metrics.waitingPayment],
    ["Completed", metrics.completedToday],
    ["Unpaid / Partial", metrics.unpaidCompleted + metrics.partialPaid]
  ];
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{range.label} Overview</h1>
        <p className="text-sm text-slate-500">Live shop performance and current order flow from local SQLite.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {(["today", "last7", "month", "all"] as DateRangeKey[]).map((key) => (
          <Button key={key} variant={rangeKey === key ? "primary" : "secondary"} onClick={() => setRangeKey(key)}>{rangeForKey(key).label}</Button>
        ))}
        <Button variant="secondary" disabled>Custom Range Coming Soon</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <PosMetricCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} detail={range.label} />)}
      </div>
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {statusCards.map(([status, count], index) => (
            <div key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{status}</div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-950">{count}</span>
                <Badge tone={index === 1 ? "blue" : "slate"}>{range.label}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-lg font-bold text-slate-950">Package Count</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["Synthetic Blend Oil Change", "Full Synthetic Oil Change", "Mobil 1 Full Synthetic Oil Change", "Diesel Oil Change"].map((name) => {
            const match = packageCounts.find((item) => item.packageName === name);
            return (
              <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-600">{name}</div>
                <div className="mt-3 text-2xl font-bold text-slate-950">{match?.count ?? 0}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-lg font-bold text-slate-950">Payment Method Totals</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["Cash", "Card", "Check", "Other"].map((method) => {
            const match = payments.find((payment) => payment.method.toLowerCase() === method.toLowerCase());
            return (
              <div key={method} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-600">{method}</div>
                <div className="mt-3 text-2xl font-bold text-slate-950">{formatMoney(match?.total ?? 0)}</div>
                <div className="mt-1 text-xs text-slate-500">{match?.count ?? 0} payment(s)</div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
