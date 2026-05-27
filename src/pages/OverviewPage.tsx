import { Activity, CarFront, Clock3, ExternalLink, PackageSearch, PanelLeft, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { PosMetricCard } from "../components/pos";
import { getTodayDashboardMetrics, listActiveTickets, type DashboardMetrics } from "../lib/db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import { formatMoney } from "../lib/utils/money";
import type { TicketWithDetails } from "../types/ticket";

const emptyMetrics: DashboardMetrics = { todaySales: 0, netSales: 0, carCount: 0, averageTicket: 0, openTickets: 0, lowInventory: 0, vehicleCountToday: 0, unpaidCompleted: 0, waitingPayment: 0, inService: 0, completedToday: 0, partialPaid: 0 };

function ticketLabel(ticket: TicketWithDetails) {
  const customer = [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
  const vehicle = [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
  return { customer, vehicle };
}

export function OverviewPage({ onStartTicket, onOpenBays, onOpenOrders, onOpenInventory, onOpenCheckInWall, onOpenWaitingPayment, onOpenWorkOrders, onOpenPaymentManager, onOpenBlankOrder, onOpenTicket }: { onStartTicket?: () => void; onOpenBays?: () => void; onOpenOrders?: () => void; onOpenInventory?: () => void; onOpenCheckInWall?: () => void; onOpenWaitingPayment?: () => void; onOpenWorkOrders?: () => void; onOpenPaymentManager?: () => void; onOpenBlankOrder?: () => void; onOpenTicket?: (ticketId: string) => void }) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [activeTickets, setActiveTickets] = useState<TicketWithDetails[]>([]);

  useEffect(() => {
    getTodayDashboardMetrics().then(setMetrics).catch(() => setMetrics(emptyMetrics));
    listActiveTickets().then((rows) => setActiveTickets(rows.slice(0, 6))).catch(() => setActiveTickets([]));
  }, []);

  const kpis = useMemo(() => [
    { label: "Oil Changes Completed", value: String(metrics.completedToday), icon: CarFront, detail: "Today" },
    { label: "In Bay", value: String(metrics.inService), icon: PanelLeft, detail: "Currently in service" },
    { label: "Waiting Payment", value: String(metrics.waitingPayment), icon: Clock3, detail: "Ready for checkout" },
    { label: "Checked In", value: String(Math.max(metrics.openTickets - metrics.inService - metrics.waitingPayment, 0)), icon: Activity, detail: "Ready to start" },
    { label: "Avg Service Time", value: "--", icon: Clock3, detail: "Available after service timing" },
    { label: "Low Stock Alerts", value: String(metrics.lowInventory), icon: PackageSearch, detail: "Operational alerts" }
  ], [metrics]);

  const bay1 = activeTickets.find((ticket) => ticket.bay === "Bay 1" && ticket.status === "in_service") ?? null;
  const bay2 = activeTickets.find((ticket) => ticket.bay === "Bay 2" && ticket.status === "in_service") ?? null;
  const waitingPayment = activeTickets.filter((ticket) => ticket.status === "waiting_payment");
  const shouldPulseWaitingPayment = waitingPayment.length > 0;

  return (
    <section className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Today's operational shop flow. Financial analytics are under Admin." action={<Button icon={<Sparkles size={18} />} onClick={onStartTicket}>Quick Start Ticket</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.label === "Low Stock Alerts" ? onOpenInventory : kpi.label === "Checked In" ? onOpenCheckInWall : kpi.label === "Waiting Payment" ? onOpenWaitingPayment : kpi.label === "Oil Changes Completed" ? onOpenOrders : onOpenBays}
            className={`rounded-[var(--pos-radius-xl)] text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] ${kpi.label === "Waiting Payment" && metrics.waitingPayment > 0 ? "waiting-payment-alert" : ""}`}
          >
            <PosMetricCard label={kpi.label} value={kpi.value} icon={kpi.icon} detail={kpi.detail} />
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-[var(--pos-text)]">Bay Status</h2>
            <Badge tone="blue">Live Shop Board</Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[{ bay: "Bay 1", ticket: bay1 }, { bay: "Bay 2", ticket: bay2 }].map(({ bay, ticket }) => {
              const label = ticket ? ticketLabel(ticket) : null;
              return (
                <div key={bay} className="rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-black text-[var(--pos-text)]">{bay}</div>
                    <Badge tone={ticket ? "green" : "slate"}>{ticket ? "In Service" : "Empty"}</Badge>
                  </div>
                  {ticket && label ? (
                    <div className="mt-5">
                      <div className="text-xl font-black text-[var(--pos-text)]">{label.customer}</div>
                      <div className="mt-1 text-sm text-[var(--pos-muted)]">{label.vehicle}</div>
                      <div className="mt-3 text-sm font-semibold text-[var(--pos-blue)]">{ticket.service_names ?? "Service in progress"}</div>
                    </div>
                  ) : <p className="mt-5 text-sm text-[var(--pos-muted)]">Assign a checked-in ticket from Active Bays.</p>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card className={`p-6 ${shouldPulseWaitingPayment ? "waiting-payment-alert" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[var(--pos-text)]">Waiting Payment</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Tickets ready for checkout.</p>
            </div>
            <button
              type="button"
              onClick={onOpenWaitingPayment}
              className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
            >
              <Badge tone="yellow">{waitingPayment.length}</Badge>
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {waitingPayment.length ? waitingPayment.map((ticket) => {
              const label = ticketLabel(ticket);
              return (
                <div key={ticket.id} className="waiting-payment-ticket-accent rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-[var(--pos-blue)]">Invoice {getDisplayInvoiceNumber(ticket)}</div>
                      <div className="font-black text-[var(--pos-text)]">{label.customer}</div>
                      <div className="text-sm text-[var(--pos-muted)]">{label.vehicle}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-[var(--pos-text)]">{formatMoney(ticket.total)}</div>
                      <div className="text-xs text-[var(--pos-muted)]">{ticket.updated_at ? new Date(ticket.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => onOpenTicket?.(ticket.id)}>Open Ticket</Button>
                  </div>
                </div>
              );
            }) : <p className="text-sm text-[var(--pos-muted)]">No tickets waiting for payment.</p>}
          </div>
        </Card>
      </div>
      <Card className="p-6">
        <h2 className="text-xl font-black text-[var(--pos-text)]">Daily Checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["Check bays and supplies", "Review low stock alerts", "Keep waiting payment lane clear"].map((task) => (
            <div key={task} className="rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-card-hover)] p-4 text-sm font-bold text-[var(--pos-text)]">{task}</div>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-xl font-black text-[var(--pos-text)]">Quick Actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Button variant="secondary" onClick={onStartTicket}>Start Ticket</Button>
          <Button variant="secondary" onClick={onOpenWorkOrders}>Work Orders</Button>
          <Button variant="secondary" onClick={onOpenBays}>Active Bays</Button>
          <Button variant="secondary" onClick={onOpenPaymentManager}>Payment Manager</Button>
          <Button variant="secondary" onClick={onOpenBlankOrder}>Blank Order</Button>
        </div>
      </Card>
    </section>
  );
}
