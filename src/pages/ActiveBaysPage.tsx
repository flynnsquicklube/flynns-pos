import { Clock3, ExternalLink, Play, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/useToast";
import { cancelTicket, listActiveTickets, markWaitingPayment, moveTicketBay, startService } from "../lib/db/repositories/ticketsRepo";
import type { TicketWithDetails } from "../types/ticket";

function elapsed(createdAt: string) {
  const minutes = Math.max(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000), 0);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

interface ActiveBaysPageProps {
  onOpenTicket: (ticketId: string) => void;
}

function TicketCard({
  ticket,
  onOpenTicket,
  onStart,
  onMoveBay,
  onWaitingPayment,
  onCancel
}: {
  ticket: TicketWithDetails;
  onOpenTicket: (id: string) => void;
  onStart?: (id: string, bay: string) => void;
  onMoveBay?: (id: string, bay: string) => void;
  onWaitingPayment?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  return (
    <button onClick={() => onOpenTicket(ticket.id)} className="w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-md">
      <div className="flex justify-between gap-4">
        <div>
          <div className="font-bold text-slate-950">{ticket.customer_first_name} {ticket.customer_last_name}</div>
          <div className="text-sm text-slate-500">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ")}</div>
        </div>
        <Badge tone={ticket.status === "waiting_payment" ? "yellow" : ticket.status === "in_service" ? "blue" : "slate"}>{ticket.status}</Badge>
      </div>
      <div className="mt-3 text-sm text-slate-700">{ticket.service_names ?? "Service ticket"}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span className="flex items-center gap-2"><Clock3 size={16} />{elapsed(ticket.created_at)}</span>
        {onStart ? (
          <span className="flex gap-2" onClick={(event) => event.stopPropagation()}>
            <Button size="sm" icon={<Play size={14} />} onClick={() => onStart(ticket.id, "Bay 1")}>Bay 1</Button>
            <Button size="sm" variant="secondary" onClick={() => onStart(ticket.id, "Bay 2")}>Bay 2</Button>
          </span>
        ) : onMoveBay || onWaitingPayment ? (
          <span className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
            {onMoveBay ? <Button size="sm" variant="secondary" onClick={() => onMoveBay(ticket.id, ticket.bay === "Bay 2" ? "Bay 1" : "Bay 2")}>Move Bay</Button> : null}
            {onWaitingPayment ? <Button size="sm" onClick={() => onWaitingPayment(ticket.id)}>Waiting Pay</Button> : null}
            {onCancel ? <Button size="sm" variant="danger" icon={<XCircle size={14} />} onClick={() => onCancel(ticket.id)}>Cancel</Button> : null}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)]">Open <ExternalLink size={15} /></span>
        )}
      </div>
    </button>
  );
}

export function ActiveBaysPage({ onOpenTicket }: ActiveBaysPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const loadTickets = () => {
    listActiveTickets().then(setTickets).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load bay board."));
  };

  useEffect(loadTickets, []);

  const start = async (ticketId: string, bay: string) => {
    try {
      await startService(ticketId, bay);
      notify({ tone: "success", title: "Service started", message: `${bay} assigned.` });
      loadTickets();
    } catch (err) {
      notify({ tone: "error", title: "Could not start service", message: err instanceof Error ? err.message : "Status update failed." });
    }
  };

  const moveBay = async (ticketId: string, bay: string) => {
    try {
      await moveTicketBay(ticketId, bay);
      notify({ tone: "success", title: "Bay moved", message: `${bay} assigned.` });
      loadTickets();
    } catch (err) {
      notify({ tone: "error", title: "Could not move bay", message: err instanceof Error ? err.message : "Bay update failed." });
    }
  };

  const waiting = async (ticketId: string) => {
    try {
      await markWaitingPayment(ticketId);
      notify({ tone: "success", title: "Waiting payment", message: "Ticket moved to waiting payment." });
      loadTickets();
    } catch (err) {
      notify({ tone: "error", title: "Could not update status", message: err instanceof Error ? err.message : "Status update failed." });
    }
  };

  const cancel = async (ticketId: string) => {
    try {
      await cancelTicket(ticketId);
      notify({ tone: "success", title: "Ticket canceled", message: "The ticket was removed from active bays." });
      loadTickets();
    } catch (err) {
      notify({ tone: "error", title: "Could not cancel ticket", message: err instanceof Error ? err.message : "Cancel failed." });
    }
  };

  const checkedIn = tickets.filter((ticket) => ticket.status === "checked_in");
  const waitingPayment = tickets.filter((ticket) => ticket.status === "waiting_payment");
  const bay1 = tickets.filter((ticket) => ticket.status === "in_service" && ticket.bay !== "Bay 2");
  const bay2 = tickets.filter((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 2");

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Active Bays</h1>
        <p className="text-sm text-slate-500">Track checked-in, in-service, and waiting-payment tickets.</p>
      </div>
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr_360px]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-950">In Line / Checked In</h2><Badge tone="blue">{checkedIn.length}</Badge></div>
          <div className="space-y-3">{checkedIn.length ? checkedIn.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} onStart={start} onCancel={cancel} />) : <EmptyState title="No Orders" message="Checked-in tickets appear here." />}</div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          {[["Bay 1", bay1], ["Bay 2", bay2]].map(([bay, bayTickets]) => (
            <Card key={bay as string} className="min-h-[460px] p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-950">{bay as string}</h2><Badge tone="blue">{(bayTickets as TicketWithDetails[]).length} active</Badge></div>
              <div className="space-y-3">{(bayTickets as TicketWithDetails[]).length ? (bayTickets as TicketWithDetails[]).map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} onMoveBay={moveBay} onWaitingPayment={waiting} onCancel={cancel} />) : <EmptyState title="No Orders" message="Start service from the checked-in list." />}</div>
            </Card>
          ))}
        </div>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-950">Waiting Payment</h2><Badge tone="yellow">{waitingPayment.length}</Badge></div>
          <div className="space-y-3">{waitingPayment.length ? waitingPayment.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} />) : <EmptyState title="No Orders" message="Completed service tickets waiting for payment appear here." />}</div>
        </Card>
      </div>
    </section>
  );
}
