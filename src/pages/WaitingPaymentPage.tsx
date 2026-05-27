import { Clock3, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { getTicketPaymentSummary, type TicketPaymentSummary } from "../lib/db/repositories/paymentsRepo";
import { listActiveTickets } from "../lib/db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import { formatMoney } from "../lib/utils/money";
import type { TicketWithDetails } from "../types/ticket";

interface WaitingPaymentPageProps {
  onOpenTicket: (ticketId: string) => void;
}

function customerName(ticket: TicketWithDetails) {
  return [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in Customer";
}

function vehicleName(ticket: TicketWithDetails) {
  return [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle not set";
}

function plateLabel(ticket: TicketWithDetails) {
  return [ticket.vehicle_plate, ticket.vehicle_plate_state].filter(Boolean).join(" ") || "No plate";
}

function elapsed(value: string) {
  const minutes = Math.max(Math.floor((Date.now() - new Date(value).getTime()) / 60000), 0);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function WaitingPaymentPage({ onOpenTicket }: WaitingPaymentPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [summaries, setSummaries] = useState<Record<string, TicketPaymentSummary>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listActiveTickets()
      .then((rows) => {
        const waiting = rows.filter((ticket) => ticket.status === "waiting_payment");
        setTickets(waiting);
        return Promise.all(waiting.map((ticket) => getTicketPaymentSummary(ticket.id).then((summary) => [ticket.id, summary] as const).catch(() => null)));
      })
      .then((rows) => {
        const next: Record<string, TicketPaymentSummary> = {};
        rows.forEach((row) => {
          if (row) next[row[0]] = row[1];
        });
        setSummaries(next);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load waiting-payment tickets."));
  }, []);

  const totals = useMemo(() => tickets.reduce((sum, ticket) => sum + (summaries[ticket.id]?.balanceDue ?? ticket.total), 0), [summaries, tickets]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-amber-600">Waiting Payment</h1>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Tickets ready for checkout.</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="yellow">{tickets.length} tickets</Badge>
          <Badge tone="blue">{formatMoney(totals)} due</Badge>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      {tickets.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {tickets.map((ticket) => {
            const summary = summaries[ticket.id];
            const paid = summary?.paid ?? 0;
            const due = summary?.balanceDue ?? Math.max(ticket.total - paid, 0);
            return (
              <Card key={ticket.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">Invoice {getDisplayInvoiceNumber(ticket)}</div>
                    <div className="mt-1 text-xl font-black text-[var(--pos-text)]">{customerName(ticket)}</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">{vehicleName(ticket)} · Plate {plateLabel(ticket)}</div>
                  </div>
                  <Badge tone="yellow">Waiting Payment</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
                    <div className="font-black text-[var(--pos-text)]">{formatMoney(ticket.total)}</div>
                    <div className="text-xs text-[var(--pos-muted)]">Total</div>
                  </div>
                  <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
                    <div className="font-black text-[var(--pos-text)]">{formatMoney(paid)}</div>
                    <div className="text-xs text-[var(--pos-muted)]">Paid</div>
                  </div>
                  <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
                    <div className="font-black text-[var(--pos-danger)]">{formatMoney(due)}</div>
                    <div className="text-xs text-[var(--pos-muted)]">Amount Due</div>
                  </div>
                  <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
                    <div className="flex items-center gap-1 font-black text-[var(--pos-text)]"><Clock3 size={14} /> {elapsed(ticket.updated_at ?? ticket.created_at)}</div>
                    <div className="text-xs text-[var(--pos-muted)]">Waiting</div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button icon={<ExternalLink size={16} />} onClick={() => onOpenTicket(ticket.id)}>Open Ticket</Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No tickets waiting for payment." message="Tickets moved to checkout will appear here." />
      )}
    </section>
  );
}
