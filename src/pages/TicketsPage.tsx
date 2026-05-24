import { Clock, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { listTicketsWithDetails } from "../lib/db/repositories/ticketsRepo";
import { formatMoney } from "../lib/utils/money";
import type { TicketStatus, TicketWithDetails } from "../types/ticket";

interface TicketsPageProps {
  onOpenTicket: (ticketId: string) => void;
}

const columns: { key: TicketStatus; title: string }[] = [
  { key: "checked_in", title: "Checked In" },
  { key: "in_service", title: "In Service" },
  { key: "waiting_payment", title: "Waiting Payment" },
  { key: "completed", title: "Completed Today" }
];

const statusLabels: Record<TicketStatus, string> = {
  draft: "Draft",
  checked_in: "Checked In",
  in_service: "In Service",
  waiting_payment: "Waiting Payment",
  completed: "Completed",
  canceled: "Canceled"
};

function waitTime(createdAt: string) {
  const minutes = Math.max(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000), 0);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function createdTime(createdAt: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(createdAt));
}

function customerName(ticket: TicketWithDetails) {
  return [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
}

function vehicleName(ticket: TicketWithDetails) {
  return [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
}

export function TicketsPage({ onOpenTicket }: TicketsPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTicketsWithDetails()
      .then(setTickets)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load tickets."))
      .finally(() => setLoading(false));
  }, []);

  const hasTickets = tickets.some((ticket) => ticket.status !== "canceled");

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Service Bay Board</h2>
          <p className="text-sm text-slate-500">Live local ticket flow for the shop floor.</p>
        </div>
        <Badge tone="green">{loading ? "Loading tickets" : `${tickets.length} local tickets`}</Badge>
      </div>
      {error ? <Card className="p-4 text-sm text-red-200">{error}</Card> : null}
      {!loading && !hasTickets ? <EmptyState title="No active tickets" message="Create a checked-in ticket to start the bay workflow." /> : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const items = tickets.filter((ticket) => ticket.status === column.key);
          return (
            <Card key={column.key} className="min-h-96 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-950">{column.title}</h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-sm text-slate-600">{loading ? "--" : items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-white/60 p-5 text-center text-sm text-slate-500">No tickets</div>
              ) : (
                <div className="space-y-3">
                  {items.map((ticket) => (
                    <button key={ticket.id} onClick={() => onOpenTicket(ticket.id)} className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--brand-primary)] hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-bold text-slate-950">{customerName(ticket)}</div>
                          <div className="mt-1 text-sm text-slate-500">{vehicleName(ticket)}</div>
                        </div>
                        <Badge tone={ticket.status === "completed" ? "green" : "blue"}>{statusLabels[ticket.status]}</Badge>
                      </div>
                      <div className="mt-3 text-sm text-slate-600">{ticket.service_names ?? "No services"}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>{ticket.vehicle_mileage?.toLocaleString() ?? "No"} mi</span>
                        <span className="text-right">{formatMoney(ticket.total)}</span>
                        <span className="inline-flex items-center gap-1"><ReceiptText size={13} />{createdTime(ticket.created_at)}</span>
                        <span className="inline-flex justify-end gap-1"><Clock size={13} />{waitTime(ticket.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {tickets.some((ticket) => ticket.status === "canceled") ? (
        <Card className="p-4">
          <h3 className="font-bold text-slate-950">Canceled</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {tickets.filter((ticket) => ticket.status === "canceled").map((ticket) => (
              <button key={ticket.id} onClick={() => onOpenTicket(ticket.id)} className="rounded-md border border-slate-200 bg-white p-3 text-left hover:border-[var(--brand-primary)]">
                <div className="font-semibold text-slate-950">{customerName(ticket)}</div>
                <div className="text-sm text-slate-500">{vehicleName(ticket)} - {formatMoney(ticket.total)}</div>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </section>
  );
}
