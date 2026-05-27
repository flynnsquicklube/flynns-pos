import { Clock3, ExternalLink, Play, X } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/useToast";
import { listActiveTickets, startService } from "../lib/db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import type { TicketWithDetails } from "../types/ticket";

interface CheckInWallPageProps {
  onOpenTicket: (ticketId: string) => void;
}

function minutesWaiting(createdAt: string) {
  return Math.max(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000), 0);
}

function elapsed(createdAt: string) {
  const minutes = minutesWaiting(createdAt);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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

function serviceSummary(ticket: TicketWithDetails) {
  const names = ticket.items?.map((item) => item.name).filter(Boolean) ?? [];
  return names.slice(0, 2).join(", ") || ticket.service_names || "Service ticket";
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-black text-[var(--pos-text)]">{value}</div>
    </Card>
  );
}

function BaySelectionModal({
  ticket,
  bay1Occupied,
  bay2Occupied,
  onClose,
  onSelect
}: {
  ticket: TicketWithDetails;
  bay1Occupied: boolean;
  bay2Occupied: boolean;
  onClose: () => void;
  onSelect: (bay: "Bay 1" | "Bay 2") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[var(--pos-text)]">Start Service</h2>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">{customerName(ticket)} · {vehicleName(ticket)}</p>
          </div>
          <button className="rounded-xl p-2 text-[var(--pos-muted)] hover:bg-[var(--pos-card-hover)]" onClick={onClose} aria-label="Close bay selection">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button size="touch" disabled={bay1Occupied} onClick={() => onSelect("Bay 1")}>{bay1Occupied ? "Bay 1 Occupied" : "Bay 1"}</Button>
          <Button size="touch" disabled={bay2Occupied} onClick={() => onSelect("Bay 2")}>{bay2Occupied ? "Bay 2 Occupied" : "Bay 2"}</Button>
        </div>
      </div>
    </div>
  );
}

function CheckInTicketCard({ ticket, onOpenTicket, onStartSelect }: { ticket: TicketWithDetails; onOpenTicket: (ticketId: string) => void; onStartSelect: (ticket: TicketWithDetails) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenTicket(ticket.id)}
      className="w-full rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">Checked in {new Date(ticket.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          <div className="mt-1 text-xl font-black text-[var(--pos-text)]">{customerName(ticket)}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">{vehicleName(ticket)} · Plate {plateLabel(ticket)}</div>
        </div>
        <Badge tone="blue">Checked In</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
          <div className="flex items-center gap-1 font-black text-[var(--pos-text)]"><Clock3 size={14} /> {elapsed(ticket.created_at)}</div>
          <div className="text-xs text-[var(--pos-muted)]">Waiting</div>
        </div>
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
          <div className="font-black text-[var(--pos-text)]">{ticket.vehicle_mileage?.toLocaleString() ?? "-"}</div>
          <div className="text-xs text-[var(--pos-muted)]">Mileage</div>
        </div>
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2">
          <div className="font-black text-[var(--pos-text)]">{getDisplayInvoiceNumber(ticket)}</div>
          <div className="text-xs text-[var(--pos-muted)]">Invoice</div>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-2 text-sm font-semibold text-[var(--pos-text)]">{serviceSummary(ticket)}</div>
      {ticket.customer_concern ? <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{ticket.customer_concern}</div> : null}
      <div className="mt-4 flex flex-wrap gap-2" onClick={stop}>
        <Button className="min-w-[150px] flex-1" size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => onOpenTicket(ticket.id)}>Open Ticket</Button>
        <Button className="min-w-[150px] flex-1" size="sm" icon={<Play size={14} />} onClick={() => onStartSelect(ticket)}>Start Service</Button>
      </div>
    </button>
  );
}

export function CheckInWallPage({ onOpenTicket }: CheckInWallPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startingTicket, setStartingTicket] = useState<TicketWithDetails | null>(null);
  const { notify } = useToast();

  const loadTickets = () => {
    setError(null);
    listActiveTickets().then(setTickets).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load check-in wall."));
  };

  useEffect(loadTickets, []);

  const checkedIn = useMemo(() => tickets.filter((ticket) => ticket.status === "checked_in"), [tickets]);
  const bay1Occupied = tickets.some((ticket) => ticket.status === "in_service" && ticket.bay !== "Bay 2");
  const bay2Occupied = tickets.some((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 2");
  const oldestWait = checkedIn.length ? Math.max(...checkedIn.map((ticket) => minutesWaiting(ticket.created_at))) : 0;
  const averageWait = checkedIn.length ? Math.round(checkedIn.reduce((sum, ticket) => sum + minutesWaiting(ticket.created_at), 0) / checkedIn.length) : 0;
  const availableBays = Number(!bay1Occupied) + Number(!bay2Occupied);

  const start = async (ticketId: string, bay: "Bay 1" | "Bay 2") => {
    try {
      await startService(ticketId, bay);
      notify({ tone: "success", title: "Service started", message: `${bay} assigned.` });
      setStartingTicket(null);
      loadTickets();
    } catch (err) {
      notify({ tone: "error", title: "Could not start service", message: err instanceof Error ? err.message : "Status update failed." });
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--pos-text)]">Check-In Wall</h1>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Vehicles waiting to start service.</p>
        </div>
        <Badge tone="blue">{checkedIn.length} checked in</Badge>
      </div>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Checked In" value={checkedIn.length} />
        <SummaryCard label="Oldest Wait" value={`${oldestWait}m`} />
        <SummaryCard label="Average Wait" value={`${averageWait}m`} />
        <SummaryCard label="Available Bays" value={availableBays} />
      </div>
      {checkedIn.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {checkedIn.map((ticket) => <CheckInTicketCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} onStartSelect={setStartingTicket} />)}
        </div>
      ) : (
        <EmptyState title="No vehicles checked in." message="New tickets waiting for service will appear here." />
      )}
      {startingTicket ? (
        <BaySelectionModal
          ticket={startingTicket}
          bay1Occupied={bay1Occupied}
          bay2Occupied={bay2Occupied}
          onClose={() => setStartingTicket(null)}
          onSelect={(bay) => start(startingTicket.id, bay)}
        />
      ) : null}
    </section>
  );
}
