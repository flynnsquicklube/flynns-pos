import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalizeGlobalSearchQuery, shouldRunGlobalSearch } from "../../lib/domain/search/globalSearch";
import { globalSearch, type GlobalSearchResults } from "../../lib/db/repositories/globalSearchRepo";
import { GlobalSearchResults as GlobalSearchResultsView } from "./GlobalSearchResults";

const emptyResults: GlobalSearchResults = { customers: [], vehicles: [], tickets: [] };

interface GlobalSearchBoxProps {
  onCustomer: (id: string) => void;
  onVehicle: (id: string) => void;
  onTicket: (id: string) => void;
  onStartCustomer: (id: string) => void;
  onStartVehicle: (id: string) => void;
  onStartTicketVehicle?: (vehicleLookup: string, customerId?: string | null) => void;
  onUseVin?: (vin: string) => void;
}

export function GlobalSearchBox({ onCustomer, onVehicle, onTicket, onStartCustomer, onStartVehicle, onStartTicketVehicle, onUseVin }: GlobalSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const normalized = normalizeGlobalSearchQuery(query);
    if (!shouldRunGlobalSearch(normalized)) {
      setResults(emptyResults);
      setOpen(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      globalSearch(normalized)
        .then((nextResults) => {
          setResults(nextResults);
          setError(null);
          setOpen(true);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Search failed.");
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const closeAndClear = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative min-w-[180px] flex-1">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--pos-muted)]" size={20} />
      <input
        className="h-13 min-h-12 w-full rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] pl-12 pr-4 text-base text-[var(--pos-text)] outline-none transition placeholder:text-[var(--pos-muted-2)] focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]"
        placeholder="Search customers, vehicles, orders..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (shouldRunGlobalSearch(query)) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results.tickets[0]) {
            closeAndClear();
            onTicket(results.tickets[0].id);
          }
        }}
      />
      {open ? (
        <GlobalSearchResultsView
          results={results}
          loading={loading}
          error={error}
          query={query}
          onCustomer={(id) => { closeAndClear(); onCustomer(id); }}
          onVehicle={(id) => { closeAndClear(); onVehicle(id); }}
          onTicket={(id) => { closeAndClear(); onTicket(id); }}
          onStartCustomer={(id) => { closeAndClear(); onStartCustomer(id); }}
          onStartVehicle={(id) => { closeAndClear(); onStartVehicle(id); }}
          onStartTicketVehicle={onStartTicketVehicle ? (vehicleLookup, customerId) => { closeAndClear(); onStartTicketVehicle(vehicleLookup, customerId); } : undefined}
          onUseVin={onUseVin ? (vin) => { closeAndClear(); onUseVin(vin); } : undefined}
        />
      ) : null}
    </div>
  );
}
