import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { countVehicleSearchResults, createVehicle, getVehicleById, getVehicleStats, listRecentVehicles, searchVehiclesAdvanced, updateVehicle, type VehicleSearchResult, type VehicleStats } from "../lib/db/repositories/vehiclesRepo";
import { searchCustomersAdvanced } from "../lib/db/repositories/customersRepo";
import { listTicketsWithDetails } from "../lib/db/repositories/ticketsRepo";
import { getServiceHistoryByVehicle } from "../lib/db/repositories/serviceHistoryRepo";
import { useToast } from "../components/ui/useToast";
import type { Vehicle } from "../types/vehicle";
import type { Customer } from "../types/customer";
import type { TicketWithDetails } from "../types/ticket";
import type { ServiceHistory } from "../types/serviceHistory";

interface VehiclesPageProps {
  initialVehicleId?: string;
  onStartTicket?: () => void;
}

export function VehiclesPage({ initialVehicleId, onStartTicket }: VehiclesPageProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vehicles, setVehicles] = useState<VehicleSearchResult[]>([]);
  const [stats, setStats] = useState<VehicleStats>({ totalVehicles: 0, importedVehicles: 0, recentVehicles: 0 });
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
  const { notify } = useToast();

  const loadVehicles = useCallback((nextOffset = 0, append = false) => {
    setLoading(true);
    const query = debouncedSearch.trim();
    const listPromise = query ? searchVehiclesAdvanced(query, 50, nextOffset) : listRecentVehicles(10);
    const countPromise = query ? countVehicleSearchResults(query) : Promise.resolve(10);
    Promise.all([listPromise, countPromise])
      .then(([rows, count]) => {
        setVehicles((current) => append ? [...current, ...rows] : rows);
        setResultCount(count);
        setOffset(nextOffset + rows.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load vehicles."))
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadVehicles(0, false);
  }, [loadVehicles]);

  useEffect(() => {
    void getVehicleStats().then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    searchCustomersAdvanced("", {}, 100, 0).then(setCustomers).catch(() => setCustomers([]));
  }, []);

  const load = () => loadVehicles(0, false);
  const openVehicle = useCallback(async (vehicle: Vehicle) => {
    setSelected(vehicle);
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
  }, []);

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
        <div>
          <h2 className="text-2xl font-black text-slate-950">Vehicles</h2>
          <p className="text-sm text-slate-500">Vehicle records stored locally.</p>
        </div>
        <Button variant="secondary" icon={<Plus size={16} />} onClick={() => { setShowAdd(true); setSelected(null); setForm({ customer_id: customers[0]?.id ?? "", year: "", make: "", model: "", vin: "", plate: "", plate_state: "OH", mileage: "", oil_type: "", notes: "" }); }}>Add Vehicle</Button>
      </div>
      <Input inputSize="touch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search VIN, plate, year, make, model, or customer..." />
      {!debouncedSearch.trim() ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4"><div className="text-sm text-slate-500">Total Vehicles</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.totalVehicles}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Imported</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.importedVehicles}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Recent</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.recentVehicles}</div></Card>
        </div>
      ) : null}
      {error ? <Card className="p-4 text-sm text-red-200">{error}</Card> : null}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
          <span>{debouncedSearch.trim() ? `${resultCount} matching vehicle${resultCount === 1 ? "" : "s"}` : "Recent vehicles"}</span>
          {loading ? <span>Searching...</span> : null}
        </div>
        {vehicles.length === 0 ? (
          <EmptyState title={loading ? "Loading vehicles" : "No vehicles yet"} message="Customer vehicles will appear here once created." />
        ) : (
          <div className="divide-y divide-white/10">
            {vehicles.map((vehicle) => (
              <button key={vehicle.id} onClick={() => void openVehicle(vehicle)} className="flex w-full items-center justify-between py-3 text-left">
                <div>
                  <div className="font-semibold text-slate-950">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                  <div className="text-sm text-slate-500">{vehicle.plate ?? "No plate"} {vehicle.plate_state ?? ""} · {vehicle.customer_name ?? "No owner"}</div>
                </div>
                <div className="text-sm text-slate-500">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "Mileage needed"}</div>
              </button>
            ))}
          </div>
        )}
        {debouncedSearch.trim() && vehicles.length < resultCount ? (
          <div className="border-t border-slate-200 pt-4 text-center">
            <Button variant="secondary" disabled={loading} onClick={() => loadVehicles(offset, true)}>Load More</Button>
          </div>
        ) : null}
      </Card>
      {(selected || showAdd) ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-slate-950">{selected ? "Vehicle Detail" : "Add Vehicle"}</h3>
            <Button onClick={onStartTicket}>Start Ticket</Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">Owner
              <select className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3" value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}>
                <option value="">Select customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.first_name} {customer.last_name}</option>)}
              </select>
            </label>
            <Input label="Year" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
            <Input label="Make" value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
            <Input label="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
            <Input label="VIN" value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value })} />
            <Input label="Plate" value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value.toUpperCase() })} />
            <Input label="State" value={form.plate_state} onChange={(event) => setForm({ ...form, plate_state: event.target.value.toUpperCase() })} />
            <Input label="Mileage" value={form.mileage} onChange={(event) => setForm({ ...form, mileage: event.target.value })} />
            <Input label="Oil type" value={form.oil_type} onChange={(event) => setForm({ ...form, oil_type: event.target.value })} />
            <Input className="md:col-span-3" label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <Button className="mt-3" onClick={saveVehicle}>{selected ? "Save Vehicle" : "Create Vehicle"}</Button>
          {selected ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="font-bold text-slate-950">Tickets ({tickets.length})</div>
                <div className="mt-3 space-y-2 text-sm">{tickets.slice(0, 8).map((ticket) => <div key={ticket.id}>{ticket.status} · {ticket.service_names ?? "Ticket"} · {new Date(ticket.created_at).toLocaleDateString()}</div>)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="font-bold text-slate-950">Service History ({history.length})</div>
                <div className="mt-3 space-y-2 text-sm">{history.slice(0, 8).map((entry) => <div key={entry.id}>{new Date(entry.service_date).toLocaleDateString()} · {entry.mileage.toLocaleString()} mi · {entry.oil_type ?? "Service"}</div>)}</div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
