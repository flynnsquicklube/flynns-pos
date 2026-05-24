import { CarFront, ClipboardList, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { formatMoney } from "../../lib/utils/money";
import type { GlobalSearchResults as Results } from "../../lib/db/repositories/globalSearchRepo";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface GlobalSearchResultsProps {
  results: Results;
  loading: boolean;
  error: string | null;
  query: string;
  onCustomer: (id: string) => void;
  onVehicle: (id: string) => void;
  onTicket: (id: string) => void;
  onStartCustomer: (id: string) => void;
  onStartVehicle: (id: string) => void;
  onStartTicketVehicle?: (vehicleId: string, customerId?: string | null) => void;
  onUseVin?: (vin: string) => void;
}

export function GlobalSearchResults({ results, loading, error, query, onCustomer, onVehicle, onTicket, onStartCustomer, onStartVehicle, onStartTicketVehicle, onUseVin }: GlobalSearchResultsProps) {
  const hasResults = results.customers.length + results.vehicles.length + results.tickets.length > 0;
  const looksLikeVin = /^[A-HJ-NPR-Z0-9]{17}$/i.test(query.trim());
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[520px] overflow-auto rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 shadow-2xl">
      {loading ? <div className="p-4 text-sm font-semibold text-[var(--pos-muted)]">Searching local SQLite...</div> : null}
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {!loading && !error && !hasResults ? (
        <div className="space-y-3 p-4 text-sm text-[var(--pos-muted)]">
          <div>No results found.</div>
          {looksLikeVin && onUseVin ? <button className="result-row border border-[var(--pos-border)]" onClick={() => onUseVin(query.trim().toUpperCase())}>Use VIN for new vehicle<span>{query.trim().toUpperCase()}</span></button> : null}
        </div>
      ) : null}
      {results.customers.length ? (
        <ResultGroup title="Customers">
          {results.customers.map((customer) => (
            <div key={customer.id} className="result-row min-h-14" role="button" tabIndex={0} onClick={() => onCustomer(customer.id)} onKeyDown={(event) => { if (event.key === "Enter") onCustomer(customer.id); }}>
              <span className="flex min-w-0 items-center gap-3">
                <UserRound size={20} className="shrink-0 text-[var(--pos-blue-2)]" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{customer.first_name} {customer.last_name}</span>
                  <span className="block truncate">{customer.phone} · {customer.email ?? "No email"} · {customer.vehicle_count} vehicle{customer.vehicle_count === 1 ? "" : "s"}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                <Button size="sm" onClick={(event) => { event.stopPropagation(); onStartCustomer(customer.id); }}>Start Ticket</Button>
              </span>
            </div>
          ))}
        </ResultGroup>
      ) : null}
      {results.vehicles.length ? (
        <ResultGroup title="Vehicles">
          {results.vehicles.map((vehicle) => (
            <div key={vehicle.id} className="result-row min-h-14" role="button" tabIndex={0} onClick={() => onVehicle(vehicle.id)} onKeyDown={(event) => { if (event.key === "Enter") onVehicle(vehicle.id); }}>
              <span className="flex min-w-0 items-center gap-3">
                <CarFront size={20} className="shrink-0 text-[var(--pos-blue-2)]" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</span>
                  <span className="block truncate">{vehicle.plate ?? "No plate"} {vehicle.plate_state ?? ""} · {vehicle.vin ?? "No VIN"} · {vehicle.customer_name ?? "No linked customer"}</span>
                </span>
              </span>
              <Button size="sm" onClick={(event) => { event.stopPropagation(); onStartVehicle(vehicle.id); }}>Start Ticket</Button>
            </div>
          ))}
        </ResultGroup>
      ) : null}
      {results.tickets.length ? (
        <ResultGroup title="Orders / Tickets">
          {results.tickets.map((ticket) => (
            <div key={ticket.id} className="result-row min-h-14" role="button" tabIndex={0} onClick={() => onTicket(ticket.id)} onKeyDown={(event) => { if (event.key === "Enter") onTicket(ticket.id); }}>
              <span className="flex min-w-0 items-center gap-3">
                <ClipboardList size={20} className="shrink-0 text-[var(--pos-blue-2)]" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{ticket.external_id ?? ticket.id} · {ticket.status}</span>
                  <span className="block truncate">{new Date(ticket.completed_at ?? ticket.created_at).toLocaleDateString()} · {ticket.customer_name ?? "No customer"} · {ticket.vehicle_label ?? "No vehicle"}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-black text-[var(--pos-text)]">{formatMoney(ticket.total)}</span>
                {ticket.vehicle_id ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onStartTicketVehicle && ticket.vehicle_id) onStartTicketVehicle(ticket.vehicle_id, ticket.customer_id);
                    }}
                    disabled={!onStartTicketVehicle}
                  >
                    New Same Vehicle
                  </Button>
                ) : null}
              </span>
            </div>
          ))}
        </ResultGroup>
      ) : null}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1 py-1">
      <div className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--pos-muted-2)]">{title}</div>
      {children}
    </div>
  );
}
