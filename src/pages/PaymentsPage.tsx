import { CreditCard, ExternalLink, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { getTicketPaymentSummary, listPayments, type PaymentWithTicket, type TicketPaymentSummary } from "../lib/db/repositories/paymentsRepo";
import { listActiveTickets } from "../lib/db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import { formatMoney } from "../lib/utils/money";
import type { TicketWithDetails } from "../types/ticket";

interface PaymentsPageProps {
  onOpenTicket?: (ticketId: string) => void;
}

function customerName(ticket: TicketWithDetails) {
  return [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in Customer";
}

function vehicleName(ticket: TicketWithDetails) {
  return [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
}

function PaymentTicketCard({ ticket, summary, onOpenTicket }: { ticket: TicketWithDetails; summary?: TicketPaymentSummary; onOpenTicket?: (ticketId: string) => void }) {
  const paid = summary?.paid ?? 0;
  const due = summary?.balanceDue ?? Math.max(ticket.total - paid, 0);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">Invoice {getDisplayInvoiceNumber(ticket)}</div>
          <div className="mt-1 text-lg font-black text-[var(--pos-text)]">{customerName(ticket)}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">{vehicleName(ticket)}</div>
        </div>
        <Badge tone={due > 0 ? "yellow" : "green"}>{due > 0 ? "Due" : "Paid"}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2"><div className="font-black">{formatMoney(ticket.total)}</div><div className="text-xs text-[var(--pos-muted)]">Total</div></div>
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2"><div className="font-black">{formatMoney(paid)}</div><div className="text-xs text-[var(--pos-muted)]">Paid</div></div>
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2"><div className="font-black text-[var(--pos-danger)]">{formatMoney(due)}</div><div className="text-xs text-[var(--pos-muted)]">Amount Due</div></div>
      </div>
      {onOpenTicket ? <div className="mt-4 flex justify-end"><Button icon={<ExternalLink size={16} />} onClick={() => onOpenTicket(ticket.id)}>Open Ticket</Button></div> : null}
    </Card>
  );
}

export function PaymentsPage({ onOpenTicket }: PaymentsPageProps) {
  const [payments, setPayments] = useState<PaymentWithTicket[]>([]);
  const [activeTickets, setActiveTickets] = useState<TicketWithDetails[]>([]);
  const [summaries, setSummaries] = useState<Record<string, TicketPaymentSummary>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPayments(), listActiveTickets()])
      .then(async ([paymentRows, ticketRows]) => {
        setPayments(paymentRows);
        setActiveTickets(ticketRows);
        const summaryRows = await Promise.all(ticketRows.map((ticket) => getTicketPaymentSummary(ticket.id).then((summary) => [ticket.id, summary] as const).catch(() => null)));
        const next: Record<string, TicketPaymentSummary> = {};
        summaryRows.forEach((row) => {
          if (row) next[row[0]] = row[1];
        });
        setSummaries(next);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load payment manager."));
  }, []);

  const waitingPayment = activeTickets.filter((ticket) => ticket.status === "waiting_payment");
  const partialPayments = activeTickets.filter((ticket) => ["partial", "partially_paid"].includes(ticket.payment_status));
  const paidNotFinalized = activeTickets.filter((ticket) => ticket.payment_status === "paid" && ticket.status !== "completed");
  const todaysPayments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return payments.filter((payment) => payment.paid_at?.startsWith(today) && `${payment.customer_first_name ?? ""} ${payment.customer_last_name ?? ""} ${payment.method}`.toLowerCase().includes(search.toLowerCase()));
  }, [payments, search]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-amber-600">Payment Manager</h1>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Operational checkout queues and today's payment records.</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="yellow">{waitingPayment.length} waiting</Badge>
          <Badge tone="blue">{todaysPayments.length} payments today</Badge>
        </div>
      </div>
      <Input className="max-w-md" placeholder="Search today's payments" value={search} onChange={(event) => setSearch(event.target.value)} />
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-[var(--pos-text)]"><CreditCard size={20} /> Waiting Payment</h2>
          <div className="mt-4 space-y-3">{waitingPayment.length ? waitingPayment.map((ticket) => <PaymentTicketCard key={ticket.id} ticket={ticket} summary={summaries[ticket.id]} onOpenTicket={onOpenTicket} />) : <EmptyState title="No waiting payments" message="Tickets ready for checkout will appear here." />}</div>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-black text-[var(--pos-text)]">Partial Payments</h2>
          <div className="mt-4 space-y-3">{partialPayments.length ? partialPayments.map((ticket) => <PaymentTicketCard key={ticket.id} ticket={ticket} summary={summaries[ticket.id]} onOpenTicket={onOpenTicket} />) : <EmptyState title="No partial payments" message="Partially paid active tickets will appear here." />}</div>
        </Card>
        <Card className="p-5">
          <h2 className="text-xl font-black text-[var(--pos-text)]">Paid Not Finalized</h2>
          <div className="mt-4 space-y-3">{paidNotFinalized.length ? paidNotFinalized.map((ticket) => <PaymentTicketCard key={ticket.id} ticket={ticket} summary={summaries[ticket.id]} onOpenTicket={onOpenTicket} />) : <EmptyState title="No paid tickets pending finalization" message="Paid active tickets will appear here until finalized." />}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-5 py-3 text-lg font-black text-[var(--pos-text)]"><Receipt size={19} /> Today's Payments</div>
        {todaysPayments.length ? todaysPayments.map((payment) => (
          <div key={payment.id} className="grid gap-3 border-b border-[var(--pos-border)] px-5 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_auto_auto]">
            <div><div className="font-black text-[var(--pos-text)]">{payment.customer_first_name} {payment.customer_last_name}</div><div className="text-[var(--pos-muted)]">{payment.method} · {payment.status}</div></div>
            <div className="text-[var(--pos-muted)]">{new Date(payment.paid_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
            <div className="font-black text-[var(--pos-text)]">{formatMoney(payment.amount)}</div>
          </div>
        )) : <EmptyState title="No payments today" message="Completed checkout payments will appear here." />}
      </Card>
    </section>
  );
}
