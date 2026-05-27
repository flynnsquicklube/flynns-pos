import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { TouchSelect } from "../components/ui/TouchSelect";
import { VehicleInfoLookupModal } from "../components/vehicle-info/VehicleInfoLookupModal";
import { applyVehicleDecode, countVehicleSearchResults, createVehicle, getVehicleById, getVehicleStats, searchVehiclesAdvanced, updateVehicle, type VehicleQuickFilter, type VehicleSearchFilters, type VehicleSearchResult, type VehicleStats } from "../lib/db/repositories/vehiclesRepo";
import { searchCustomersAdvanced } from "../lib/db/repositories/customersRepo";
import { listTicketsWithDetails } from "../lib/db/repositories/ticketsRepo";
import { getServiceHistoryByVehicle } from "../lib/db/repositories/serviceHistoryRepo";
import { useToast } from "../components/ui/useToast";
import type { Vehicle } from "../types/vehicle";
import type { Customer } from "../types/customer";
import type { TicketWithDetails } from "../types/ticket";
import type { ServiceHistory } from "../types/serviceHistory";
import { setStartTicketContext } from "../lib/domain/startTicket/startTicketContext";
import { StatePicker } from "../components/vehicles/StatePicker";
import { decodeVinWithFallback, isVinDecodeEnabled } from "../lib/integrations/vinDecoder/vinDecoder.service";
import type { NormalizedVehicleDecode } from "../lib/integrations/vinDecoder/vinDecoder.types";
import { isFuelEconomyEnabled, searchEpaVehicleCandidates } from "../lib/integrations/fuelEconomy/fuelEconomy.service";
import type { FuelEconomyVehicleCandidate } from "../lib/integrations/fuelEconomy/fuelEconomy.types";
import { getOilCapacity, getOilFilters } from "../lib/integrations/parts/partFitment.service";
import type { PartFitmentResult } from "../lib/integrations/parts/partFitment.types";
import { getVehiclePunchCard, type VehiclePunchCard } from "../lib/domain/loyalty/punchCardRules";
import { listPunchEvents, type VehiclePunchEvent } from "../lib/db/repositories/punchCardsRepo";
import { saveVehicleInfoDefaults } from "../lib/db/repositories/vehicleInfoLookupRepo";

interface VehiclesPageProps {
  initialVehicleId?: string;
  onStartTicket?: () => void;
}

export function VehiclesPage({ initialVehicleId, onStartTicket }: VehiclesPageProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vehicles, setVehicles] = useState<VehicleSearchResult[]>([]);
  const [stats, setStats] = useState<VehicleStats>({ totalVehicles: 0, importedVehicles: 0, recentVehicles: 0, vehiclesWithServiceHistory: 0 });
  const [activeFilter, setActiveFilter] = useState<VehicleQuickFilter | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer_id: "", year: "", make: "", model: "", vin: "", plate: "", plate_state: "OH", mileage: "", oil_type: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vinDecoderEnabled, setVinDecoderEnabled] = useState(false);
  const [epaEnabled, setEpaEnabled] = useState(false);
  const [vehicleDecode, setVehicleDecode] = useState<NormalizedVehicleDecode | null>(null);
  const [vehicleDecoding, setVehicleDecoding] = useState(false);
  const [epaMatches, setEpaMatches] = useState<FuelEconomyVehicleCandidate[]>([]);
  const [epaLoading, setEpaLoading] = useState(false);
  const [fitment, setFitment] = useState<PartFitmentResult | null>(null);
  const [punchCard, setPunchCard] = useState<VehiclePunchCard | null>(null);
  const [punchEvents, setPunchEvents] = useState<VehiclePunchEvent[]>([]);
  const [vehicleInfoLookupOpen, setVehicleInfoLookupOpen] = useState(false);
  const { notify } = useToast();

  const filtersFor = useCallback((filter: VehicleQuickFilter | null): VehicleSearchFilters => ({
    recent: filter === "recent",
    imported: filter === "imported",
    withHistory: filter === "withHistory",
    openTickets: filter === "openTickets"
  }), []);

  const loadVehicles = useCallback((nextOffset = 0, append = false) => {
    setLoading(true);
    const query = debouncedSearch.trim();
    const hasSearchOrFilter = Boolean(query || activeFilter);
    if (!hasSearchOrFilter) {
      setVehicles([]);
      setResultCount(0);
      setOffset(0);
      if (!initialVehicleId) setSelected(null);
      setLoading(false);
      return;
    }
    const filters = filtersFor(activeFilter);
    const listPromise = searchVehiclesAdvanced(query, filters, 25, nextOffset);
    const countPromise = countVehicleSearchResults(query, filters);
    Promise.all([listPromise, countPromise])
      .then(([rows, count]) => {
        setVehicles((current) => append ? [...current, ...rows] : rows);
        setResultCount(count);
        setOffset(nextOffset + rows.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load vehicles."))
      .finally(() => setLoading(false));
  }, [activeFilter, debouncedSearch, filtersFor, initialVehicleId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadVehicles(0, false);
  }, [loadVehicles]);

  useEffect(() => {
    void getVehicleStats().then(setStats).catch(() => undefined);
    isVinDecodeEnabled().then(setVinDecoderEnabled).catch(() => setVinDecoderEnabled(false));
    isFuelEconomyEnabled().then(setEpaEnabled).catch(() => setEpaEnabled(false));
  }, []);

  useEffect(() => {
    if (!showAdd && !selected) return;
    if (customers.length) return;
    searchCustomersAdvanced("", {}, 100, 0).then(setCustomers).catch(() => setCustomers([]));
  }, [customers.length, selected, showAdd]);

  const load = () => loadVehicles(0, false);
  const hasSearchOrFilter = Boolean(debouncedSearch.trim() || activeFilter);
  const filterButtons: { key: VehicleQuickFilter; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "imported", label: "Imported" },
    { key: "withHistory", label: "With History" },
    { key: "openTickets", label: "Open Tickets" }
  ];

  const openVehicle = useCallback(async (vehicle: Vehicle) => {
    setSelected(vehicle);
    setVehicleDecode(null);
    setEpaMatches([]);
    setFitment(null);
    setPunchCard(null);
    setPunchEvents([]);
    setForm({
      customer_id: vehicle.customer_id,
      year: vehicle.year ? String(vehicle.year) : "",
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      vin: vehicle.vin ?? "",
      plate: vehicle.plate ?? "",
      plate_state: vehicle.plate_state ?? "OH",
      mileage: vehicle.mileage ? String(vehicle.mileage) : "",
      oil_type: vehicle.oil_type ?? "",
      notes: vehicle.notes ?? ""
    });
    const [vehicleTickets, serviceHistory] = await Promise.all([listTicketsWithDetails({ includeCompletedTodayOnly: false }), getServiceHistoryByVehicle(vehicle.id)]);
    setTickets(vehicleTickets.filter((ticket) => ticket.vehicle_id === vehicle.id));
    setHistory(serviceHistory);
    setPunchCard(await getVehiclePunchCard(vehicle.id));
    setPunchEvents(await listPunchEvents(vehicle.id));
    const [filters, capacity] = await Promise.all([
      getOilFilters({ vehicleId: vehicle.id, vin: vehicle.vin, year: vehicle.year, make: vehicle.make, model: vehicle.model, engine: vehicle.engine_model }).catch(() => null),
      getOilCapacity({ vehicleId: vehicle.id, vin: vehicle.vin, year: vehicle.year, make: vehicle.make, model: vehicle.model, engine: vehicle.engine_model }).catch(() => null)
    ]);
    setFitment(filters ?? capacity ? { ok: true, status: "ready", message: "Local fitment loaded.", parts: filters?.parts ?? [], specs: capacity?.specs ?? [] } : null);
  }, []);

  const decodeSelectedVehicle = async (forceRefresh = true) => {
    const vin = form.vin || selected?.vin;
    if (!selected || !vin) {
      notify({ tone: "error", title: "VIN required", message: "Save or enter a VIN before decoding." });
      return;
    }
    if (!vinDecoderEnabled) {
      notify({ tone: "info", title: "VIN decoder disabled", message: "Continue with manual vehicle specs." });
      return;
    }
    setVehicleDecoding(true);
    try {
      const result = await decodeVinWithFallback(vin, { modelYear: form.year || selected.year || null, forceRefresh });
      if (result.ok && result.data) {
        setVehicleDecode(result.data);
        notify({ tone: "success", title: "VIN decoded", message: [result.data.year, result.data.make, result.data.model].filter(Boolean).join(" ") || result.data.vin });
      } else {
        notify({ tone: "error", title: "VIN decode unavailable", message: result.message });
      }
    } finally {
      setVehicleDecoding(false);
    }
  };

  const applySelectedDecode = async (overwrite = false) => {
    if (!selected || !vehicleDecode) return;
    if (overwrite && !window.confirm("Overwrite existing vehicle fields with decoded VIN data?")) return;
    await applyVehicleDecode(selected.id, vehicleDecode, overwrite);
    const updated = await getVehicleById(selected.id);
    if (updated) await openVehicle(updated);
    notify({ tone: "success", title: "Decoded data applied", message: overwrite ? "Vehicle fields were refreshed." : "Empty vehicle fields were filled." });
  };

  const enrichWithEpa = async () => {
    if (!selected?.year || !selected.make || !selected.model) {
      notify({ tone: "error", title: "Vehicle specs needed", message: "Year, make, and model are required for EPA matching." });
      return;
    }
    setEpaLoading(true);
    try {
      const result = await searchEpaVehicleCandidates(selected.year, selected.make, selected.model);
      setEpaMatches(result.data ?? []);
      notify({ tone: result.ok ? "success" : "error", title: result.ok ? "EPA matches loaded" : "EPA lookup failed", message: result.message });
    } finally {
      setEpaLoading(false);
    }
  };

  const applyEpaMatch = async (match: FuelEconomyVehicleCandidate, overwrite = false) => {
    if (!selected) return;
    if (overwrite && !window.confirm("Overwrite existing vehicle fields with EPA data?")) return;
    const current = await getVehicleById(selected.id);
    if (!current) return;
    await updateVehicle(selected.id, {
      customer_id: current.customer_id,
      vin: current.vin,
      plate: current.plate,
      plate_state: current.plate_state,
      year: overwrite ? match.year ?? current.year : current.year ?? match.year,
      make: overwrite ? match.make ?? current.make : current.make ?? match.make,
      model: overwrite ? match.model ?? current.model : current.model ?? match.model,
      mileage: current.mileage,
      oil_type: current.oil_type,
      notes: current.notes
    });
    const updated = await getVehicleById(selected.id);
    if (updated) await openVehicle(updated);
    notify({ tone: "success", title: "EPA data applied", message: "Basic vehicle fields were updated where safe." });
  };

  const clearServiceDefaults = async () => {
    if (!selected) return;
    if (!window.confirm("Clear saved service defaults for this vehicle?")) return;
    await saveVehicleInfoDefaults(selected.id, {
      oil_type: null,
      oil_capacity: null,
      oil_filter_sku: null,
      oil_filter_inventory_item_id: null,
      air_filter_sku: null,
      cabin_filter_sku: null,
      vehicle_info_notes: null,
      vehicle_info_source_url: null,
      vehicle_info_source_title: null
    });
    const updated = await getVehicleById(selected.id);
    if (updated) await openVehicle(updated);
    notify({ tone: "success", title: "Defaults cleared", message: "Vehicle service defaults were cleared." });
  };

  useEffect(() => {
    if (!initialVehicleId) return;
    void getVehicleById(initialVehicleId).then((vehicle) => {
      if (vehicle) void openVehicle(vehicle);
    });
  }, [initialVehicleId, openVehicle]);

  const saveVehicle = async () => {
    if (!form.customer_id || !form.year || !form.make.trim() || !form.model.trim()) {
      notify({ tone: "error", title: "Vehicle details needed", message: "Customer, year, make, and model are required." });
      return;
    }
    const payload = {
      customer_id: form.customer_id,
      vin: form.vin || null,
      plate: form.plate || null,
      plate_state: form.plate_state || null,
      year: Number(form.year),
      make: form.make,
      model: form.model,
      mileage: Number(form.mileage) || null,
      oil_type: form.oil_type || null,
      notes: form.notes || null
    };
    if (selected) {
      await updateVehicle(selected.id, payload);
      notify({ tone: "success", title: "Vehicle updated" });
      load();
      await openVehicle({ ...selected, ...payload });
    } else {
      const vehicle = await createVehicle(payload);
      notify({ tone: "success", title: "Vehicle added" });
      setShowAdd(false);
      void getVehicleStats().then(setStats).catch(() => undefined);
      load();
      await openVehicle(vehicle);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <PageHeader theme="cyan" className="flex-1" title="Vehicles" subtitle="Find vehicles by VIN, plate, customer, or service history." />
        <Button variant="secondary" icon={<Plus size={16} />} onClick={() => { setShowAdd(true); setSelected(null); setForm({ customer_id: customers[0]?.id ?? "", year: "", make: "", model: "", vin: "", plate: "", plate_state: "OH", mileage: "", oil_type: "", notes: "" }); }}>Add Vehicle</Button>
      </div>
      <Card className="p-5">
        <div className="relative">
          <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
          <Input inputSize="touch" className="pl-12 text-lg" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search VIN, plate, year, make, model, or customer..." />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filterButtons.map((filter) => (
            <Button key={filter.key} variant={activeFilter === filter.key ? "primary" : "secondary"} onClick={() => setActiveFilter((current) => current === filter.key ? null : filter.key)}>
              {filter.label}
            </Button>
          ))}
        </div>
      </Card>
      {!hasSearchOrFilter ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Total Vehicles</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.totalVehicles}</div></Card>
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Imported</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.importedVehicles}</div></Card>
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">With Service History</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.vehiclesWithServiceHistory}</div></Card>
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Recent</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.recentVehicles}</div></Card>
        </div>
      ) : null}
      {!hasSearchOrFilter ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-blue-2)]">
            <Search size={24} />
          </div>
          <h2 className="mt-4 text-xl font-black text-[var(--pos-text)]">Search to view vehicles</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--pos-muted)]">
            Enter VIN, plate, year, make, model, or customer name to find vehicle records.
          </p>
        </Card>
      ) : null}
      {error ? <Card className="p-4 text-sm text-red-200">{error}</Card> : null}
      {hasSearchOrFilter ? <Card className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm text-[var(--pos-muted)]">
          <span>{resultCount} matching vehicle{resultCount === 1 ? "" : "s"}</span>
          {loading ? <span>Searching...</span> : null}
        </div>
        {vehicles.length === 0 ? (
          <EmptyState title={loading ? "Loading vehicles" : "No vehicles found"} message="Try another VIN, plate, year, make, model, or customer." />
        ) : (
          <div className="divide-y divide-white/10">
            {vehicles.map((vehicle) => (
              <button key={vehicle.id} onClick={() => void openVehicle(vehicle)} className="flex w-full items-center justify-between py-3 text-left">
                <div>
                  <div className="font-semibold text-[var(--pos-text)]">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                  <div className="text-sm text-[var(--pos-muted)]">{vehicle.plate ?? "No plate"} {vehicle.plate_state ?? ""} · {vehicle.customer_name ?? "No owner"}</div>
                </div>
                <div className="text-sm text-[var(--pos-muted)]">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "Mileage needed"}</div>
              </button>
            ))}
          </div>
        )}
        {hasSearchOrFilter && vehicles.length < resultCount ? (
          <div className="border-t border-[var(--pos-border)] pt-4 text-center">
            <Button variant="secondary" disabled={loading} onClick={() => loadVehicles(offset, true)}>Load More</Button>
          </div>
        ) : null}
      </Card> : null}
      {(selected || showAdd) ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-[var(--pos-text)]">{selected ? "Vehicle Detail" : "Add Vehicle"}</h3>
            <Button onClick={() => { if (selected) setStartTicketContext({ vehicleId: selected.id, customerId: selected.customer_id, source: "vehicle_detail" }); onStartTicket?.(); }}>Start Ticket</Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <TouchSelect label="Owner" value={form.customer_id} onChange={(customer_id) => setForm({ ...form, customer_id })} options={customers.map((customer) => ({ value: customer.id, label: `${customer.first_name} ${customer.last_name}`.trim() || "Unnamed customer", description: customer.phone || customer.email || undefined }))} placeholder="Select customer" searchable />
            <Input label="Year" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
            <Input label="Make" value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
            <Input label="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
            <Input label="VIN" value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value })} />
            <Input label="Plate" value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value.toUpperCase() })} />
            <StatePicker label="State" value={form.plate_state} onChange={(plate_state) => setForm({ ...form, plate_state })} />
            <Input label="Mileage" value={form.mileage} onChange={(event) => setForm({ ...form, mileage: event.target.value })} />
            <Input label="Oil type" value={form.oil_type} onChange={(event) => setForm({ ...form, oil_type: event.target.value })} />
            <Input className="md:col-span-3" label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <Button className="mt-3" onClick={saveVehicle}>{selected ? "Save Vehicle" : "Create Vehicle"}</Button>
          {selected ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--pos-border)] p-4 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--pos-text)]">Vehicle Service Defaults</div>
                    <div className="text-sm text-[var(--pos-muted)]">Oil capacity, oil type, and filter defaults are used as suggestions on future tickets.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setVehicleInfoLookupOpen(true)}>Lookup Vehicle Info</Button>
                    <Button variant="secondary" onClick={clearServiceDefaults}>Clear Defaults</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <span className="rounded-lg bg-[var(--pos-panel-2)] p-3">Oil capacity: <strong>{selected.oil_capacity ? `${selected.oil_capacity} qt` : "Not saved"}</strong></span>
                  <span className="rounded-lg bg-[var(--pos-panel-2)] p-3">Oil type: <strong>{selected.oil_type ?? "Not saved"}</strong></span>
                  <span className="rounded-lg bg-[var(--pos-panel-2)] p-3">Oil filter: <strong>{selected.oil_filter_sku ?? "Not saved"}</strong></span>
                  <span className="rounded-lg bg-[var(--pos-panel-2)] p-3">Air filter: <strong>{selected.air_filter_sku ?? "Not saved"}</strong></span>
                  <span className="rounded-lg bg-[var(--pos-panel-2)] p-3">Cabin filter: <strong>{selected.cabin_filter_sku ?? "Not saved"}</strong></span>
                  <span className="rounded-lg bg-[var(--pos-panel-2)] p-3">Verified: <strong>{selected.vehicle_info_verified_at ? new Date(selected.vehicle_info_verified_at).toLocaleDateString() : "Not verified"}</strong></span>
                </div>
                {selected.vehicle_info_source_title || selected.vehicle_info_notes ? (
                  <div className="mt-3 rounded-lg bg-[var(--pos-panel-2)] p-3 text-sm text-[var(--pos-muted)]">
                    {selected.vehicle_info_source_title ? <div><strong>Source:</strong> {selected.vehicle_info_source_title}</div> : null}
                    {selected.vehicle_info_notes ? <div className="mt-1"><strong>Notes:</strong> {selected.vehicle_info_notes}</div> : null}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-[var(--pos-border)] p-4 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--pos-text)]">VIN Decoder</div>
                    <div className="text-sm text-[var(--pos-muted)]">
                      {selected.vin ? `VIN ${selected.vin}` : "No VIN saved."} {selected.vin_decoded_at ? `· Last decoded ${new Date(selected.vin_decoded_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vinDecoderEnabled ? (
                      <Button variant="secondary" disabled={!selected.vin || vehicleDecoding} onClick={() => void decodeSelectedVehicle(true)}>
                        {vehicleDecoding ? "Decoding..." : selected.vin_decoded_at ? "Refresh Decode" : "Decode VIN"}
                      </Button>
                    ) : null}
                    <Button variant="secondary" disabled={!vehicleDecode} onClick={() => void applySelectedDecode(false)}>Apply Empty Fields</Button>
                    <Button variant="secondary" disabled={!vehicleDecode} onClick={() => void applySelectedDecode(true)}>Overwrite Existing</Button>
                  </div>
                </div>
                {vehicleDecode ? (
                  <div className="mt-4 grid gap-2 rounded-lg bg-[var(--pos-panel-2)] p-3 text-sm md:grid-cols-3">
                    <span><strong>{vehicleDecode.year ?? "-"}</strong> {vehicleDecode.make ?? ""} {vehicleDecode.model ?? ""} {vehicleDecode.trim ?? ""}</span>
                    <span>Engine: {vehicleDecode.engineModel ?? vehicleDecode.engineDisplacementL ?? "-"}</span>
                    <span>Fuel/drive: {[vehicleDecode.fuelType, vehicleDecode.driveType].filter(Boolean).join(" / ") || "-"}</span>
                    <span>Body: {vehicleDecode.bodyClass ?? "-"}</span>
                    <span>Manufacturer: {vehicleDecode.manufacturer ?? "-"}</span>
                    <span>Source: {vehicleDecode.source} · {vehicleDecode.confidence}</span>
                  </div>
                ) : selected.vin_decode_source ? (
                  <div className="mt-4 grid gap-2 rounded-lg bg-[var(--pos-panel-2)] p-3 text-sm md:grid-cols-3">
                    <span>Trim: {selected.trim ?? "-"}</span>
                    <span>Engine: {selected.engine_model ?? selected.engine_displacement_l ?? "-"}</span>
                    <span>Source: {selected.vin_decode_source} · {selected.vin_decode_confidence ?? "unknown"}</span>
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-[var(--pos-border)] p-4 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--pos-text)]">External & Local Vehicle Data</div>
                    <div className="text-sm text-[var(--pos-muted)]">Local history is always available. EPA matching appears only when enabled in Settings.</div>
                  </div>
                  {epaEnabled ? <Button variant="secondary" disabled={epaLoading} onClick={() => void enrichWithEpa()}>{epaLoading ? "Searching..." : "Enrich EPA Data"}</Button> : null}
                </div>
                {fitment ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-[var(--pos-panel-2)] p-3 text-sm">
                      <div className="font-bold text-[var(--pos-text)]">Local Fitment Suggestions</div>
                      {fitment.parts.slice(0, 4).map((part) => <div key={`${part.source}-${part.sku ?? part.name}`} className="mt-2 text-[var(--pos-muted)]">{part.name} {part.sku ? `· ${part.sku}` : ""} · {part.source}</div>)}
                      {!fitment.parts.length ? <div className="mt-2 text-[var(--pos-muted)]">No prior parts found.</div> : null}
                    </div>
                    <div className="rounded-lg bg-[var(--pos-panel-2)] p-3 text-sm">
                      <div className="font-bold text-[var(--pos-text)]">Service Specs From History</div>
                      {fitment.specs?.map((spec) => <div key={`${spec.category}-${spec.source}`} className="mt-2 text-[var(--pos-muted)]">{spec.category.replace("_", " ")}: {spec.value ?? "-"} {spec.unit ?? ""} · {spec.source}</div>)}
                      {!fitment.specs?.length ? <div className="mt-2 text-[var(--pos-muted)]">No prior oil capacity found.</div> : null}
                    </div>
                  </div>
                ) : null}
                {epaMatches.length ? (
                  <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-lg border border-[var(--pos-border)] text-sm">
                    {epaMatches.slice(0, 5).map((match) => (
                      <div key={match.epaVehicleId} className="grid gap-2 p-3 md:grid-cols-[1fr_1fr_auto]">
                        <span className="font-semibold text-[var(--pos-text)]">{match.year} {match.make} {match.model} · {match.transmission ?? match.trim ?? "EPA option"}</span>
                        <span className="text-[var(--pos-muted)]">{match.fuelType ?? "-"} · {match.drive ?? "-"} · MPG {match.mpgCombined ?? "-"}</span>
                        <Button size="sm" variant="secondary" onClick={() => void applyEpaMatch(match, false)}>Apply Empty</Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-[var(--pos-border)] p-4 lg:col-span-2">
                <div className="font-bold text-[var(--pos-text)]">Loyalty Punch Card</div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--pos-muted)] md:grid-cols-3">
                  <span>Current punches: <strong>{punchCard?.punch_count ?? 0}</strong></span>
                  <span>Free rewards available: <strong>{punchCard?.free_rewards_available ?? 0}</strong></span>
                  <span>Sync status: <strong>{punchCard?.sync_status ?? "No local punch card yet"}</strong></span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--pos-panel-2)]">
                  <div className="h-full bg-[var(--brand-primary)]" style={{ width: `${Math.min(((punchCard?.punch_count ?? 0) / 5) * 100, 100)}%` }} />
                </div>
                <div className="mt-3 space-y-1 text-sm text-[var(--pos-muted)]">
                  {punchEvents.slice(0, 5).map((event) => <div key={event.id}>{new Date(event.created_at).toLocaleDateString()} · {event.event_type} · punch {event.punch_delta} · reward {event.reward_delta}</div>)}
                  {!punchEvents.length ? <div>No punch history yet.</div> : null}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--pos-border)] p-4">
                <div className="font-bold text-[var(--pos-text)]">Tickets ({tickets.length})</div>
                <div className="mt-3 space-y-2 text-sm">{tickets.slice(0, 8).map((ticket) => <div key={ticket.id}>{ticket.status} · {ticket.service_names ?? "Ticket"} · {new Date(ticket.created_at).toLocaleDateString()}</div>)}</div>
              </div>
              <div className="rounded-lg border border-[var(--pos-border)] p-4">
                <div className="font-bold text-[var(--pos-text)]">Service History ({history.length})</div>
                <div className="mt-3 space-y-2 text-sm">{history.slice(0, 8).map((entry) => <div key={entry.id}>{new Date(entry.service_date).toLocaleDateString()} · {entry.mileage.toLocaleString()} mi · {entry.oil_type ?? "Service"}</div>)}</div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
      {selected ? (
        <VehicleInfoLookupModal
          open={vehicleInfoLookupOpen}
          context={{
            vehicleId: selected.id,
            vehicle: selected,
            vin: selected.vin,
            year: selected.year,
            make: selected.make,
            model: selected.model,
            engine: selected.engine_model
          }}
          currentDefaults={{
            oil_type: selected.oil_type,
            oil_capacity: selected.oil_capacity,
            oil_filter_sku: selected.oil_filter_sku,
            oil_filter_inventory_item_id: selected.oil_filter_inventory_item_id,
            air_filter_sku: selected.air_filter_sku,
            cabin_filter_sku: selected.cabin_filter_sku,
            vehicle_info_notes: selected.vehicle_info_notes,
            vehicle_info_source_url: selected.vehicle_info_source_url,
            vehicle_info_source_title: selected.vehicle_info_source_title
          }}
          onClose={() => setVehicleInfoLookupOpen(false)}
          onSaved={async () => {
            const updated = await getVehicleById(selected.id);
            if (updated) await openVehicle(updated);
          }}
        />
      ) : null}
    </section>
  );
}
