import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { listOrderHistory } from "../lib/db/repositories/ticketsRepo";
import { formatMoney } from "../lib/utils/money";
import type { TicketWithDetails } from "../types/ticket";

interface OrderHistoryPageProps {
  onOpenTicket: (ticketId: string) => void;
}

export function OrderHistoryPage({ onOpenTicket }: OrderHistoryPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrderHistory().then(setTickets).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load orders."));
  }, []);

  const filtered = tickets.filter((ticket) => {
    const haystack = `${ticket.customer_first_name ?? ""} ${ticket.customer_last_name ?? ""} ${ticket.vehicle_make ?? ""} ${ticket.vehicle_model ?? ""} ${ticket.vehicle_plate ?? ""} ${ticket.id}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Order History</h1>
        <p className="text-sm text-slate-500">Review completed, open, and canceled orders.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary">All Operations</Button>
        <Button variant="secondary">Dates</Button>
        <Input className="max-w-sm" placeholder="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button variant="secondary" icon={<SlidersHorizontal size={16} />}>Filters</Button>
      </div>
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="No Orders" message="Completed and finalized orders will appear here." />
        ) : (
          <>
          <div className="hidden overflow-auto lg:block">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Start Date", "End Date", "Customer", "Fleet Location", "Status", "Pay Status", "Order ID", "Amount", "Vehicle", "Plate", "Operation", "Internal Note"].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr key={ticket.id} onClick={() => onOpenTicket(ticket.id)} className={`cursor-pointer ${ticket.status === "completed" ? "bg-emerald-50/60 hover:bg-emerald-50" : "bg-white hover:bg-slate-50"}`}>
                    <td className="border-b border-slate-100 px-4 py-3">{new Date(ticket.created_at).toLocaleDateString()}</td>
                    <td className="border-b border-slate-100 px-4 py-3">{ticket.completed_at ? new Date(ticket.completed_at).toLocaleDateString() : "-"}</td>
                    <td className="border-b border-slate-100 px-4 py-3 font-medium">{ticket.customer_first_name} {ticket.customer_last_name}</td>
                    <td className="border-b border-slate-100 px-4 py-3">-</td>
                    <td className="border-b border-slate-100 px-4 py-3"><Badge tone={ticket.status === "completed" ? "green" : "slate"}>{ticket.status}</Badge></td>
                    <td className="border-b border-slate-100 px-4 py-3"><Badge tone={ticket.payment_status === "paid" ? "green" : "yellow"}>{ticket.payment_status === "paid" ? "Paid" : "Not Paid"}</Badge></td>
                    <td className="border-b border-slate-100 px-4 py-3">{ticket.id}</td>
                    <td className="border-b border-slate-100 px-4 py-3 font-semibold">{formatMoney(ticket.total)}</td>
                    <td className="border-b border-slate-100 px-4 py-3">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ")}</td>
                    <td className="border-b border-slate-100 px-4 py-3">{ticket.vehicle_plate ?? "-"}</td>
                    <td className="border-b border-slate-100 px-4 py-3">Flynn's Quick Lube</td>
                    <td className="border-b border-slate-100 px-4 py-3">{ticket.internal_notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 lg:hidden">
            {filtered.map((ticket) => (
              <button key={ticket.id} onClick={() => onOpenTicket(ticket.id)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-950">{ticket.customer_first_name} {ticket.customer_last_name}</div>
                    <div className="mt-1 text-sm text-slate-500">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ")}</div>
                  </div>
                  <Badge tone={ticket.status === "completed" ? "green" : "slate"}>{ticket.status}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{ticket.vehicle_plate ?? "No plate"}</span>
                  <span className="font-bold text-slate-950">{formatMoney(ticket.total)}</span>
                </div>
              </button>
            ))}
          </div>
          </>
        )}
      </Card>
    </section>
  );
}
