import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { listOrderHistory } from "../lib/db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import { rangeForKey, type DateRangeKey } from "../lib/db/repositories/reportsRepo";
import { formatMoney } from "../lib/utils/money";
import type { TicketWithDetails } from "../types/ticket";

interface OrderHistoryPageProps {
  onOpenTicket: (ticketId: string) => void;
}

export function OrderHistoryPage({ onOpenTicket }: OrderHistoryPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOrderHistory().then(setTickets).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load orders."));
  }, []);

  const filtered = tickets.filter((ticket) => {
    const haystack = `${ticket.customer_first_name ?? ""} ${ticket.customer_last_name ?? ""} ${ticket.vehicle_make ?? ""} ${ticket.vehicle_model ?? ""} ${ticket.vehicle_plate ?? ""} ${ticket.vehicle_vin ?? ""} ${ticket.id} ${getDisplayInvoiceNumber(ticket)} ${ticket.service_names ?? ""}`.toLowerCase();
    const range = rangeForKey(rangeKey);
    const ticketDate = new Date(ticket.completed_at ?? ticket.created_at).getTime();
    const inRange = (!range.dateFrom || ticketDate >= new Date(range.dateFrom).getTime()) && (!range.dateTo || ticketDate <= new Date(range.dateTo).getTime());
    const normalizedPayStatus = ticket.payment_status === "partial" ? "partially_paid" : ticket.payment_status;
    return inRange && haystack.includes(search.toLowerCase()) && (status === "all" || ticket.status === status) && (paymentStatus === "all" || normalizedPayStatus === paymentStatus);
  });

  return (
    <section className="space-y-5">
      <PageHeader title="Orders" subtitle="Search completed, active, canceled, and imported orders." />
      <div className="flex flex-wrap items-center gap-3">
        {(["today", "last7", "month", "all"] as DateRangeKey[]).map((key) => (
          <Button key={key} variant={rangeKey === key ? "primary" : "secondary"} onClick={() => setRangeKey(key)}>{rangeForKey(key).label}</Button>
        ))}
        <select className="min-h-12 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-sm font-semibold text-[var(--pos-text)]" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="checked_in">Checked In</option>
          <option value="in_service">In Service</option>
          <option value="waiting_payment">Waiting Payment</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
        <select className="min-h-12 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-sm font-semibold text-[var(--pos-text)]" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
          <option value="all">All pay statuses</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <Input className="max-w-sm" placeholder="Customer, vehicle, invoice #, VIN, plate" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="No Orders" message="Completed and finalized orders will appear here." />
        ) : (
          <>
          <div className="hidden overflow-auto lg:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="sticky top-0 bg-[var(--pos-panel-2)] text-left text-xs uppercase tracking-wide text-[var(--pos-muted)]">
                <tr>
                  {["Invoice #", "Customer", "Vehicle", "Plate", "Status", "Pay Status", "Total", "Action"].map((heading) => (
                    <th key={heading} className="border-b border-[var(--pos-border)] px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="bg-[var(--pos-card)] text-[var(--pos-text)] hover:bg-[var(--pos-card-hover)]">
                    <td className="border-b border-[var(--pos-border)] px-4 py-3 font-black text-[var(--pos-blue)]">{getDisplayInvoiceNumber(ticket)}<div className="mt-1 text-xs font-semibold text-[var(--pos-muted)]">{new Date(ticket.created_at).toLocaleDateString()}</div></td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3 font-medium">{ticket.customer_first_name} {ticket.customer_last_name}</td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ")}</td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3">{ticket.vehicle_plate ?? "-"}</td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3"><Badge tone={ticket.status === "completed" ? "green" : "slate"}>{ticket.status}</Badge></td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3"><Badge tone={ticket.payment_status === "paid" ? "green" : ticket.payment_status === "unpaid" ? "yellow" : "blue"}>{ticket.payment_status === "partial" ? "partially_paid" : ticket.payment_status}</Badge></td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3 font-semibold">{formatMoney(ticket.total)}</td>
                    <td className="border-b border-[var(--pos-border)] px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => onOpenTicket(ticket.id)}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 lg:hidden">
            {filtered.map((ticket) => (
              <button key={ticket.id} onClick={() => onOpenTicket(ticket.id)} className="rounded-xl border border-[var(--pos-border)] bg-white p-4 text-left shadow-sm hover:border-[var(--pos-blue)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--pos-text)]">{ticket.customer_first_name} {ticket.customer_last_name}</div>
                    <div className="mt-1 text-xs font-bold text-[var(--pos-blue)]">Invoice {getDisplayInvoiceNumber(ticket)}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ")}</div>
                  </div>
                  <Badge tone={ticket.status === "completed" ? "green" : "slate"}>{ticket.status}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[var(--pos-muted)]">{ticket.vehicle_plate ?? "No plate"}</span>
                  <span className="font-bold text-[var(--pos-text)]">{formatMoney(ticket.total)}</span>
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
