import { Activity, CarFront, Clock3, DollarSign } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useEffect, useMemo, useState } from "react";
import { getTodayDashboardMetrics, type DashboardMetrics } from "../lib/db/repositories/ticketsRepo";
import { getPackageCounts, todayRange, type PackageCount } from "../lib/db/repositories/reportsRepo";
import { formatMoney } from "../lib/utils/money";

const statuses = ["Scheduled", "Open", "In Line", "In Progress", "Service Complete", "Finalized Not Paid", "Finalized Partially Paid"];
const charts = ["Gross Amount / Day", "Total Package Sales", "Labor Cost", "Gross Amount / Operation", "Customers & Fleets"];
const emptyMetrics: DashboardMetrics = { todaySales: 0, carCount: 0, averageTicket: 0, openTickets: 0, lowInventory: 0, vehicleCountToday: 0, unpaidCompleted: 0, waitingPayment: 0, inService: 0 };

export function OverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [packageCounts, setPackageCounts] = useState<PackageCount[]>([]);
  useEffect(() => {
    getTodayDashboardMetrics().then(setMetrics).catch(() => setMetrics(emptyMetrics));
    getPackageCounts(todayRange()).then(setPackageCounts).catch(() => setPackageCounts([]));
  }, []);
  const kpis = useMemo(() => [
    { label: "Avg Order Value", value: formatMoney(metrics.averageTicket), icon: DollarSign },
    { label: "Sales - Gross Amount", value: formatMoney(metrics.todaySales), icon: Activity },
    { label: "Active Tickets", value: String(metrics.openTickets), icon: Clock3 },
    { label: "Vehicles", value: String(metrics.vehicleCountToday), icon: CarFront }
  ], [metrics]);
  const statusCounts = [0, metrics.openTickets, 0, metrics.inService, metrics.carCount, metrics.unpaidCompleted, 0];
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Today's Overview</h1>
        <p className="text-sm text-slate-500">Live shop performance and current order flow.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {["All Operations", "Date Range", "Compare To"].map((filter) => (
          <button key={filter} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm">{filter}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
                <Icon className="text-[var(--brand-primary)]" size={20} />
              </div>
              <div className="mt-4 text-3xl font-bold text-slate-950">{kpi.value}</div>
            </Card>
          );
        })}
      </div>
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {statuses.map((status, index) => (
            <div key={status} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{status}</div>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-950">{statusCounts[index]}</span>
                <Badge tone={index === 3 ? "blue" : "slate"}>Today</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-lg font-bold text-slate-950">Today's Package Count</h2>
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
      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-950">Time Range Overview</h2>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {charts.map((chart) => (
            <Card key={chart} className="min-h-52 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{chart}</h3>
                <Badge>Placeholder</Badge>
              </div>
              <div className="mt-8 flex h-28 items-end gap-2 border-b border-slate-200">
                {[36, 72, 44, 90, 58, 76, 52].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t bg-[var(--brand-primary-light)]" style={{ height }} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
