import { useEffect, useState } from "react";
import { AlertCircle, CarFront, ClipboardList, PackageSearch, TrendingUp } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { getDashboardMetrics, type DashboardMetrics } from "../lib/db/repositories/ticketsRepo";

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
    { label: "Car count", value: metrics.carCount.toString(), icon: CarFront },
    { label: "Open tickets", value: metrics.openTickets.toString(), icon: ClipboardList },
    { label: "In service", value: metrics.inService.toString(), icon: TrendingUp },
    { label: "Low inventory", value: metrics.lowInventory.toString(), icon: PackageSearch }
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[var(--pos-text)]">Shop Dashboard</h2>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Live local register snapshot.</p>
        </div>
        <Badge tone={error ? "red" : "green"}>{loading ? "Loading" : error ? "Unavailable" : "SQLite Connected"}</Badge>
      </div>
      {error ? (
        <Card className="flex items-center gap-3 p-4 text-sm text-[var(--pos-danger)]">
          <AlertCircle size={18} />
          {error}
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--pos-muted)]">{card.label}</span>
                <Icon className="text-[var(--pos-blue)]" size={20} />
              </div>
              <div className="mt-4 text-3xl font-black text-[var(--pos-text)]">{loading ? "--" : card.value}</div>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <h3 className="text-lg font-black text-[var(--pos-text)]">Service Lane</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "Waiting", value: loading ? "--" : String(Math.max(metrics.openTickets - metrics.inService - metrics.waitingPayment, 0)) },
              { label: "In Bay", value: loading ? "--" : String(metrics.inService) },
              { label: "Waiting Payment", value: loading ? "--" : String(metrics.waitingPayment) }
            ].map((item) => (
              <div key={item.label} className="rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
                <div className="text-sm font-semibold text-[var(--pos-muted)]">{item.label}</div>
                <div className="mt-3 text-2xl font-black text-[var(--pos-text)]">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-lg font-black text-[var(--pos-text)]">Status</h3>
          <p className="mt-4 text-sm leading-6 text-[var(--pos-muted)]">Use the Dashboard for live shop flow. Financial analytics are under Admin / Reports.</p>
        </Card>
      </div>
    </section>
  );
}
