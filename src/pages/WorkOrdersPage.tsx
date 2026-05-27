import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { cancelDraft, listActiveOrderDrafts, type OrderDraft } from "../lib/db/repositories/orderDraftsRepo";
import { getWorkOrdersForDate, type WorkOrderTicketSummary, type WorkOrdersForDate } from "../lib/db/repositories/ticketsRepo";
import { getWorkOrderStatusLabel, getWorkOrderStatusPillVariant, type WorkOrderColumnKey } from "../lib/domain/tickets/workOrderStatus";
import { todayIsoDate } from "../lib/utils/dates";
import { formatMoney } from "../lib/utils/money";

interface WorkOrdersPageProps {
  onOpenTicket: (ticketId: string) => void;
  onContinueDraft: (draftId: string) => void;
}

const emptyBoard: WorkOrdersForDate = { open: [], inBay: [], serviceComplete: [], finalized: [] };

const columns: Array<{ key: WorkOrderColumnKey; title: string; subtitle: string }> = [
  { key: "open", title: "Open", subtitle: "Tickets started but not yet in a bay." },
  { key: "inBay", title: "In Bay", subtitle: "Vehicles currently being serviced." },
  { key: "serviceComplete", title: "Service Complete", subtitle: "Service finished and waiting for payment." },
  { key: "finalized", title: "Finalized", subtitle: "Completed tickets for the selected day." }
];

const columnStyles: Record<WorkOrderColumnKey, { accent: string; badge: "blue" | "green" | "yellow" | "slate"; header: string }> = {
  open: {
    accent: "border-t-slate-300",
    badge: "slate",
    header: "bg-[var(--pos-panel-2)]"
  },
  inBay: {
    accent: "border-t-[var(--pos-blue)]",
    badge: "blue",
    header: "bg-[var(--pos-blue-soft)]"
  },
  serviceComplete: {
    accent: "border-t-amber-400",
    badge: "yellow",
    header: "bg-amber-50"
  },
  finalized: {
    accent: "border-t-emerald-500",
    badge: "green",
    header: "bg-emerald-50"
  }
};

function shiftDate(date: string, days: number) {
  const base = new Date(`${date}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function displayTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMileage(value: number | null | undefined) {
  if (!value) return "Mileage not set";
  return `${value.toLocaleString()} mi`;
}

function joinDetails(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" · ");
}

function parseDraftSummary(draft: OrderDraft): { customerName?: string | null; vehicleLabel?: string | null; packageName?: string | null; summary?: string | null; currentStep?: string | null } {
  if (!draft.summary_json) return {};
  try {
    return JSON.parse(draft.summary_json) as { customerName?: string | null; vehicleLabel?: string | null; packageName?: string | null; summary?: string | null; currentStep?: string | null };
  } catch {
    return {};
  }
}

function DraftCard({ draft, onContinueDraft, onCancel }: { draft: OrderDraft; onContinueDraft: (draftId: string) => void; onCancel: (draftId: string) => void }) {
  const summary = parseDraftSummary(draft);
  return (
    <article className="rounded-2xl border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue-2)]">Draft Order</div>
          <div className="mt-1 text-lg font-black text-[var(--pos-text)]">{draft.draft_number}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">Updated {displayTime(draft.updated_at)}</div>
        </div>
        <Badge tone="blue">Continue</Badge>
      </div>
      <div className="mt-3 space-y-1 text-sm text-[var(--pos-muted)]">
        <div className="font-black text-[var(--pos-text)]">{summary.customerName ?? "Customer not selected"}</div>
        <div>{summary.vehicleLabel ?? "Vehicle not selected"}</div>
        <div>{summary.packageName ?? summary.summary ?? "Order started"}</div>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--pos-blue-2)]">Step: {summary.currentStep ?? draft.current_step}</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Button onClick={() => onContinueDraft(draft.id)}>Continue Order</Button>
        <Button variant="secondary" onClick={() => onCancel(draft.id)}>Cancel Draft</Button>
      </div>
    </article>
  );
}

function TicketCard({ ticket, onOpenTicket }: { ticket: WorkOrderTicketSummary; onOpenTicket: (ticketId: string) => void }) {
  const statusTone = getWorkOrderStatusPillVariant(ticket);
  const isWaitingPayment = ticket.status === "waiting_payment" || ticket.amountDue > 0;
  const timeLabel = ticket.status === "completed" ? "Completed" : ticket.status === "in_service" ? "Updated" : isWaitingPayment ? "Waiting since" : "Created";
  const timeValue = ticket.status === "completed" ? ticket.completedAt ?? ticket.updatedAt : ticket.status === "in_service" ? ticket.updatedAt : ticket.createdAt;
  const amountLabel = ticket.amountDue > 0 ? "Amount due" : ticket.status === "completed" ? "Paid total" : "Ticket total";
  const amountValue = ticket.amountDue > 0 ? ticket.amountDue : ticket.total;
  const plateMileageLine = joinDetails([ticket.plate ? `Plate ${ticket.plate}` : null, formatMileage(ticket.mileage)]);
  const serviceLine = ticket.mainService ?? "Service ticket";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpenTicket(ticket.ticketId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenTicket(ticket.ticketId);
        }
      }}
      className="group w-full cursor-pointer rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)] hover:shadow-[0_16px_34px_rgba(14,27,51,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-black uppercase tracking-wide text-[var(--pos-blue)]">
            Invoice {ticket.invoiceNumber ?? ticket.ticketId}
          </div>
        </div>
        <Badge tone={statusTone} className="shrink-0">{getWorkOrderStatusLabel(ticket)}</Badge>
      </div>

      <div className="mt-3">
        <div className="break-words text-base font-black leading-snug text-[var(--pos-text)]">{ticket.customerName}</div>
        <div className="mt-1 break-words text-sm font-bold leading-snug text-[var(--pos-muted)]">{ticket.vehicleLabel}</div>
        <div className="mt-2 text-sm font-semibold leading-5 text-[var(--pos-muted)]">{plateMileageLine}</div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-2">
        <div className="break-words text-sm font-black leading-5 text-[var(--pos-text)]">{serviceLine}</div>
        {ticket.bay ? <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--pos-blue)]">{ticket.bay}</div> : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--pos-border)] pt-3">
        <div className="min-w-0 text-xs text-[var(--pos-muted)]">
          <div className="flex items-center gap-1 font-black text-[var(--pos-text)]">
            <Clock3 size={14} />
            {displayTime(timeValue)}
          </div>
          <div className="mt-0.5 font-semibold">{timeLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-black text-[var(--pos-text)]">{formatMoney(amountValue)}</div>
          <div className="text-xs font-semibold text-[var(--pos-muted)]">{amountLabel}</div>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenTicket(ticket.ticketId);
          }}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--pos-blue)] bg-white px-3 text-sm font-black text-[var(--pos-blue)] transition group-hover:bg-[var(--pos-blue)] group-hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
        >
          Open Ticket <ExternalLink size={15} />
        </button>
      </div>
    </article>
  );
}

export function WorkOrdersPage({ onOpenTicket, onContinueDraft }: WorkOrdersPageProps) {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [board, setBoard] = useState<WorkOrdersForDate>(emptyBoard);
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getWorkOrdersForDate(selectedDate), listActiveOrderDrafts()])
      .then(([nextBoard, nextDrafts]) => {
        setBoard(nextBoard);
        setDrafts(nextDrafts);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load work orders."))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const totalCount = useMemo(() => Object.values(board).reduce((sum, rows) => sum + rows.length, 0) + drafts.length, [board, drafts.length]);

  const cancelOrderDraft = async (draftId: string) => {
    const confirmed = window.confirm("Cancel this draft order?");
    if (!confirmed) return;
    await cancelDraft(draftId);
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-indigo-600">Daily Work Orders</h1>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Track today's tickets from open to finalized.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-2 shadow-sm">
          <Button variant="secondary" size="sm" className="min-h-10" icon={<ChevronLeft size={16} />} onClick={() => setSelectedDate((date) => shiftDate(date, -1))} aria-label="Previous day" />
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pos-muted)]" size={17} />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value || todayIsoDate())}
              className="min-h-10 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel)] py-2 pl-10 pr-3 text-sm font-bold text-[var(--pos-text)]"
            />
          </label>
          <Button variant="secondary" size="sm" className="min-h-10" icon={<ChevronRight size={16} />} onClick={() => setSelectedDate((date) => shiftDate(date, 1))} aria-label="Next day" />
          <Button size="sm" className="min-h-10" variant={selectedDate === todayIsoDate() ? "primary" : "secondary"} onClick={() => setSelectedDate(todayIsoDate())}>Today</Button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {!loading && totalCount === 0 ? <EmptyState title="No work orders for this date." message="Tickets created or completed on the selected day will appear here." /> : null}

      {!loading && drafts.length > 0 ? (
        <Card className="overflow-hidden border-t-4 border-t-[var(--pos-blue)]">
          <div className="border-b border-[var(--pos-border)] bg-[var(--pos-blue-soft)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--pos-text)]">Continue Orders</h2>
                <p className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">Draft orders saved from in-progress Start Ticket workflows.</p>
              </div>
              <Badge tone="blue">{drafts.length}</Badge>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft) => <DraftCard key={draft.id} draft={draft} onContinueDraft={onContinueDraft} onCancel={cancelOrderDraft} />)}
          </div>
        </Card>
      ) : null}

      <div className="-mx-2 overflow-x-auto px-2 pb-3">
        <div className="grid min-w-[1320px] grid-cols-4 gap-5 2xl:min-w-0">
          {columns.map((column) => {
            const tickets = board[column.key];
            const styles = columnStyles[column.key];
            return (
              <Card key={column.key} className={`flex min-h-[420px] min-w-[320px] flex-col overflow-hidden border-t-4 ${styles.accent}`}>
                <div className={`border-b border-[var(--pos-border)] px-4 py-4 ${styles.header}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-[var(--pos-text)]">{column.title}</h2>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--pos-muted)]">{column.subtitle}</p>
                    </div>
                    <Badge tone={styles.badge} className="shrink-0">{tickets.length}</Badge>
                  </div>
                </div>
                <div className="flex-1 space-y-3 p-4">
                  {loading ? <div className="rounded-2xl border border-dashed border-[var(--pos-border)] p-4 text-center text-sm font-semibold text-[var(--pos-muted)]">Loading orders...</div> : null}
                  {!loading && tickets.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 text-center text-sm font-black text-[var(--pos-muted)]">No Orders</div> : null}
                  {!loading ? tickets.map((ticket) => <TicketCard key={ticket.ticketId} ticket={ticket} onOpenTicket={onOpenTicket} />) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
