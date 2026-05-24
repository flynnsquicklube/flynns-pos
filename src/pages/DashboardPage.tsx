import { useEffect, useState } from "react";
import { AlertCircle, CarFront, ClipboardList, DollarSign, PackageSearch, TrendingUp } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { getDashboardMetrics, type DashboardMetrics } from "../lib/db/repositories/ticketsRepo";
import { formatMoney } from "../lib/utils/money";

const initialMetrics: DashboardMetrics = { todaySales: 0, netSales: 0, carCount: 0, averageTicket: 0, openTickets: 0, lowInventory: 0, vehicleCountToday: 0, unpaidCompleted: 0, waitingPayment: 0, inService: 0, completedToday: 0, partialPaid: 0 };

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardMetrics()
      .then(setMetrics)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load dashboard metrics."))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Today's sales", value: formatMoney(metrics.todaySales), icon: DollarSign },
    { label: "Car count", value: metrics.carCount.toString(), icon: CarFront },
    { label: "Average ticket", value: formatMoney(metrics.averageTicket), icon: TrendingUp },
    { label: "Open tickets", value: metrics.openTickets.toString(), icon: ClipboardList },
    { label: "Low inventory", value: metrics.lowInventory.toString(), icon: PackageSearch }
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Shop Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Live local register snapshot from SQLite.</p>
        </div>
        <Badge tone={error ? "red" : "green"}>{loading ? "Loading local data" : error ? "Database needs Electron" : "SQLite connected"}</Badge>
      </div>
      {error ? (
        <Card className="flex items-center gap-3 p-4 text-sm text-red-100">
          <AlertCircle size={18} />
          {error}
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">{card.label}</span>
                <Icon className="text-[var(--brand-primary)]" size={20} />
              </div>
              <div className="mt-4 text-3xl font-black text-slate-950">{loading ? "--" : card.value}</div>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <h3 className="text-lg font-bold text-slate-950">Service Lane</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {["Waiting", "In Bay", "Ready"].map((label) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-500">{label}</div>
                <div className="mt-3 text-2xl font-black text-slate-950">0</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-lg font-bold text-slate-950">Shift Notes</h3>
          <p className="mt-4 text-sm leading-6 text-slate-500">Step 1 foundation is ready for real local data. Future ticket, payment, loyalty, and sync workflows can build on this shell.</p>
        </Card>
      </div>
    </section>
  );
}
