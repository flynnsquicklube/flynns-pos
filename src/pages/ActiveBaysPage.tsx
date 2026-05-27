import { AlertTriangle, ArrowRight, ArrowRightLeft, Clock3, DoorOpen, ExternalLink } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/useToast";
import { listActiveTickets, moveTicketBay } from "../lib/db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import { formatMoney } from "../lib/utils/money";
import type { TicketWithDetails } from "../types/ticket";

interface ActiveBaysPageProps {
  onOpenTicket: (ticketId: string) => void;
  onOpenCheckInWall: () => void;
  onOpenWaitingPayment: () => void;
}

function elapsed(createdAt: string) {
  const minutes = Math.max(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000), 0);
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
  return [ticket.vehicle_plate, ticket.vehicle_plate_state].filter(Boolean).join(" ");
}

function serviceSummary(ticket: TicketWithDetails) {
  const itemNames = ticket.items?.map((item) => item.name).filter(Boolean) ?? [];
  const names = itemNames.length ? itemNames : (ticket.service_names ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  return {
    visible: names.slice(0, 2).length ? names.slice(0, 2) : ["Service ticket"],
    extra: Math.max(names.length - 2, 0)
  };
}

function stop(event: MouseEvent) {
  event.stopPropagation();
}

function SummaryActionCard({ label, value, detail, tone = "blue", alert = false, onClick }: { label: string; value: number; detail: string; tone?: "blue" | "green" | "yellow"; alert?: boolean; onClick: () => void }) {
  const toneClass = tone === "green" ? "text-[var(--pos-success)]" : tone === "yellow" ? "text-[var(--pos-warning)]" : "text-[var(--pos-blue-2)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pos-blue)] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] ${alert ? "waiting-payment-alert" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">{label}</div>
          <div className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</div>
          <div className="mt-1 text-xs font-semibold text-[var(--pos-muted)]">{detail}</div>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--pos-blue-soft)] px-2 py-1 text-xs font-black text-[var(--pos-blue)]">
          View <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

function TicketCard({ ticket, onOpenTicket, onMoveBay }: { ticket: TicketWithDetails; onOpenTicket: (id: string) => void; onMoveBay: (id: string, bay: "Bay 1" | "Bay 2") => void }) {
  const services = serviceSummary(ticket);
  const nextBay = ticket.bay === "Bay 2" ? "Bay 1" : "Bay 2";

  return (
    <button
      type="button"
      onClick={() => onOpenTicket(ticket.id)}
      className="w-full rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-black text-[var(--pos-text)]">{customerName(ticket)}</div>
          <div className="mt-1 truncate text-sm font-semibold text-[var(--pos-muted)]">
            {vehicleName(ticket)}
            {plateLabel(ticket) ? <span className="text-[var(--pos-muted-2)]"> · Plate {plateLabel(ticket)}</span> : null}
          </div>
          <div className="mt-1 text-xs font-black text-[var(--pos-blue)]">Invoice {getDisplayInvoiceNumber(ticket)}</div>
        </div>
        <Badge tone="yellow" className="shrink-0 whitespace-nowrap">In Service</Badge>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-2">
        {services.visible.map((name) => <div key={name} className="truncate text-sm font-bold text-[var(--pos-text)]">{name}</div>)}
        {services.extra > 0 ? <div className="mt-1 text-xs font-bold text-[var(--pos-blue-2)]">+{services.extra} more</div> : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2 text-[var(--pos-muted)]">
          <div className="flex items-center gap-1 font-black text-[var(--pos-text)]"><Clock3 size={14} />{elapsed(ticket.started_at ?? ticket.created_at)}</div>
          <div className="mt-0.5">Elapsed</div>
        </div>
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2 text-[var(--pos-muted)]">
          <div className="truncate font-black text-[var(--pos-text)]">{ticket.vehicle_mileage?.toLocaleString() ?? "-"}</div>
          <div className="mt-0.5">Mileage</div>
        </div>
        <div className="rounded-xl bg-[var(--pos-panel)] px-3 py-2 text-[var(--pos-muted)]">
          <div className="truncate font-black text-[var(--pos-text)]">{formatMoney(ticket.total)}</div>
          <div className="mt-0.5">Total</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" onClick={stop}>
        <Button className="min-w-[130px] flex-1" size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => onOpenTicket(ticket.id)}>Open Ticket</Button>
        <Button className="min-w-[130px] flex-1" size="sm" variant="secondary" icon={<ArrowRightLeft size={14} />} onClick={() => onMoveBay(ticket.id, nextBay)}>Move Bay</Button>
      </div>
    </button>
  );
}

function GarageBay({ name, tickets, children }: { name: "Bay 1" | "Bay 2"; tickets: TicketWithDetails[]; children: (ticket: TicketWithDetails) => JSX.Element }) {
  const occupied = tickets.length > 0;
  return (
    <section className={`relative overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,var(--pos-panel-2)_0%,var(--pos-panel)_100%)] p-5 shadow-[var(--pos-shadow-card)] ${occupied ? "border-[var(--pos-blue)]" : "border-[var(--pos-border)]"}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(148,163,184,.18) 0 2px, transparent 2px 14px)" }} />
      <header className="relative flex items-center justify-between gap-3 border-b border-[var(--pos-border)] pb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${occupied ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-[var(--pos-blue-2)]" : "border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-muted)]"}`}>
            <DoorOpen size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[var(--pos-text)]">{name}</h2>
            <p className="text-sm text-[var(--pos-muted)]">{occupied ? "In Service" : "Empty"}</p>
          </div>
        </div>
        <Badge tone={occupied ? "yellow" : "slate"}>{occupied ? `${tickets.length} active` : "Empty"}</Badge>
      </header>
      <div className="relative mt-5 min-h-[420px] rounded-3xl border border-[var(--pos-border)] bg-[radial-gradient(circle_at_top,rgba(11,124,255,.13),transparent_42%),var(--pos-bg)] p-4">
        {occupied ? (
          <div className="space-y-4">{tickets.map((ticket) => children(ticket))}</div>
        ) : (
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--pos-border)] text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-muted)]">
              <AlertTriangle size={22} />
            </div>
            <div className="mt-4 text-xl font-black text-[var(--pos-text)]">Bay Empty</div>
            <div className="mt-1 max-w-xs text-sm text-[var(--pos-muted)]">Start service from the Check-In Wall to assign this bay.</div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ActiveBaysPage({ onOpenTicket, onOpenCheckInWall, onOpenWaitingPayment }: ActiveBaysPageProps) {
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const loadTickets = () => {
    setError(null);
    listActiveTickets().then(setTickets).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load bay board."));
  };

  useEffect(loadTickets, []);

  const moveBay = async (ticketId: string, bay: "Bay 1" | "Bay 2") => {
    try {
      await moveTicketBay(ticketId, bay);
      notify({ tone: "success", title: "Bay moved", message: `${bay} assigned.` });
      loadTickets();
    } catch (err) {
      notify({ tone: "error", title: "Could not move bay", message: err instanceof Error ? err.message : "Bay update failed." });
    }
  };

  const lanes = useMemo(() => {
    const checkedIn = tickets.filter((ticket) => ticket.status === "checked_in");
    const bay1 = tickets.filter((ticket) => ticket.status === "in_service" && ticket.bay !== "Bay 2");
    const bay2 = tickets.filter((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 2");
    const waitingPayment = tickets.filter((ticket) => ticket.status === "waiting_payment");
    return { checkedIn, bay1, bay2, waitingPayment };
  }, [tickets]);

  const scrollToBays = () => {
    document.getElementById("active-bay-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--pos-blue)]">Active Bays</h1>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Bay 1 and Bay 2 only. Checked-in vehicles start from the Check-In Wall.</p>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[520px] sm:grid-cols-3">
          <SummaryActionCard label="Checked In" value={lanes.checkedIn.length} detail="Go to wall" onClick={onOpenCheckInWall} />
          <SummaryActionCard label="In Service" value={lanes.bay1.length + lanes.bay2.length} detail="Show bays" tone="yellow" onClick={scrollToBays} />
          <SummaryActionCard label="Waiting Pay" value={lanes.waitingPayment.length} detail="Go to checkout" tone="green" alert={lanes.waitingPayment.length > 0} onClick={onOpenWaitingPayment} />
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <div id="active-bay-grid" className="grid scroll-mt-6 gap-5 xl:grid-cols-2">
        <GarageBay name="Bay 1" tickets={lanes.bay1}>
          {(ticket) => <TicketCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} onMoveBay={moveBay} />}
        </GarageBay>
        <GarageBay name="Bay 2" tickets={lanes.bay2}>
          {(ticket) => <TicketCard key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} onMoveBay={moveBay} />}
        </GarageBay>
      </div>
    </section>
  );
}
