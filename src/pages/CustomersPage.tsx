import { Download, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import {
  countCustomerSearchResults,
  createCustomer,
  getCustomerById,
  getCustomerStats,
  listRecentCustomers,
  searchCustomersAdvanced,
  updateCustomer,
  type CustomerQuickFilter,
  type CustomerSearchFilters,
  type CustomerSearchResult,
  type CustomerStats
} from "../lib/db/repositories/customersRepo";
import { createVehicle, searchVehicles } from "../lib/db/repositories/vehiclesRepo";
import { listTicketsWithDetails } from "../lib/db/repositories/ticketsRepo";
import { getServiceHistoryByCustomer } from "../lib/db/repositories/serviceHistoryRepo";
import { useToast } from "../components/ui/useToast";
import type { Customer } from "../types/customer";
import type { Vehicle } from "../types/vehicle";
import type { TicketWithDetails } from "../types/ticket";
import type { ServiceHistory } from "../types/serviceHistory";
import { formatMoney } from "../lib/utils/money";
import { setStartTicketContext } from "../lib/domain/startTicket/startTicketContext";

interface CustomersPageProps {
  initialCustomerId?: string;
  onStartTicket?: () => void;
}

export function CustomersPage({ initialCustomerId, onStartTicket }: CustomersPageProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const [stats, setStats] = useState<CustomerStats>({ totalCustomers: 0, importedCustomers: 0, customersWithVehicles: 0, recentCustomers: 0 });
  const [activeFilter, setActiveFilter] = useState<CustomerQuickFilter | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tickets, setTickets] = useState<TicketWithDetails[]>([]);
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [newCustomer, setNewCustomer] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
  const [editCustomer, setEditCustomer] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
  const [newVehicle, setNewVehicle] = useState({ year: "", make: "", model: "", vin: "", plate: "", plate_state: "OH", mileage: "", oil_type: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const filtersFor = useCallback((filter: CustomerQuickFilter | null): CustomerSearchFilters => ({
    recent: filter === "recent",
    imported: filter === "imported",
    withVehicles: filter === "withVehicles",
    openTickets: filter === "openTickets"
  }), []);

  const loadCustomers = useCallback((nextOffset = 0, append = false) => {
    setLoading(true);
    const query = debouncedSearch.trim();
    const hasSearchOrFilter = Boolean(query || activeFilter);
    const filters = filtersFor(activeFilter);
    const listPromise = hasSearchOrFilter ? searchCustomersAdvanced(query, filters, 50, nextOffset) : listRecentCustomers(10);
    const countPromise = hasSearchOrFilter ? countCustomerSearchResults(query, filters) : Promise.resolve(10);
    Promise.all([listPromise, countPromise])
      .then(([rows, count]) => {
        setCustomers((current) => append ? [...current, ...rows] : rows);
        setResultCount(count);
        setOffset(nextOffset + rows.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load customers."))
      .finally(() => setLoading(false));
  }, [activeFilter, debouncedSearch, filtersFor]);

  const openCustomer = useCallback(async (customer: Customer) => {
    setSelected(customer);
    setEditCustomer({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      email: customer.email ?? "",
      notes: customer.notes ?? ""
    });
    const [customerVehicles, customerTickets, serviceHistory] = await Promise.all([
      searchVehicles("", customer.id),
      listTicketsWithDetails({ includeCompletedTodayOnly: false }),
      getServiceHistoryByCustomer(customer.id)
    ]);
    setVehicles(customerVehicles);
    setTickets(customerTickets.filter((ticket) => ticket.customer_id === customer.id));
    setHistory(serviceHistory);
  }, []);

  useEffect(() => {
    if (!initialCustomerId) return;
    void getCustomerById(initialCustomerId).then((customer) => {
      if (customer) void openCustomer(customer);
    });
  }, [initialCustomerId, openCustomer]);

  const saveSelectedCustomer = async () => {
    if (!selected) return;
    await updateCustomer(selected.id, { ...editCustomer, email: editCustomer.email || null, notes: editCustomer.notes || null });
    notify({ tone: "success", title: "Customer updated" });
    const refreshed = { ...selected, ...editCustomer, email: editCustomer.email || null, notes: editCustomer.notes || null };
    setSelected(refreshed);
    void getCustomerStats().then(setStats).catch(() => undefined);
    loadCustomers();
  };

  const addVehicle = async () => {
    if (!selected) return;
    if (!newVehicle.year || !newVehicle.make.trim() || !newVehicle.model.trim()) {
      notify({ tone: "error", title: "Vehicle details needed", message: "Year, make, and model are required." });
      return;
    }
    await createVehicle({
      customer_id: selected.id,
      vin: newVehicle.vin || null,
      plate: newVehicle.plate || null,
      plate_state: newVehicle.plate_state || null,
      year: Number(newVehicle.year),
      make: newVehicle.make,
      model: newVehicle.model,
      mileage: Number(newVehicle.mileage) || null,
      oil_type: newVehicle.oil_type || null,
      notes: null
    });
    notify({ tone: "success", title: "Vehicle added" });
    setNewVehicle({ year: "", make: "", model: "", vin: "", plate: "", plate_state: "OH", mileage: "", oil_type: "" });
    await openCustomer(selected);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void getCustomerStats().then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadCustomers(0, false);
  }, [debouncedSearch, activeFilter, loadCustomers]);

  const saveCustomer = async () => {
    if (!newCustomer.first_name.trim() || !newCustomer.last_name.trim() || !newCustomer.phone.trim()) {
      notify({ tone: "error", title: "Customer details needed", message: "First name, last name, and phone are required." });
      return;
    }
    await createCustomer({ ...newCustomer, email: newCustomer.email || null, notes: newCustomer.notes || null, firebase_uid: null, referral_code: null });
    notify({ tone: "success", title: "Customer saved", message: `${newCustomer.first_name} ${newCustomer.last_name}` });
    setShowAdd(false);
    setNewCustomer({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
    void getCustomerStats().then(setStats).catch(() => undefined);
    loadCustomers();
  };

  const hasSearchOrFilter = Boolean(debouncedSearch.trim() || activeFilter);
  const filterButtons: { key: CustomerQuickFilter; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "imported", label: "Imported" },
    { key: "withVehicles", label: "With Vehicles" },
    { key: "openTickets", label: "Open Tickets" }
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Customers & Fleets</h1>
          <p className="text-sm text-slate-500">Search customers, vehicles, and fleet accounts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled icon={<Download size={16} />}>Export Coming Soon</Button>
          <Button size="touch" icon={<Plus size={16} />} onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Close" : "Add Customer"}</Button>
        </div>
      </div>
      {showAdd ? (
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="First name" value={newCustomer.first_name} onChange={(event) => setNewCustomer({ ...newCustomer, first_name: event.target.value })} />
            <Input label="Last name" value={newCustomer.last_name} onChange={(event) => setNewCustomer({ ...newCustomer, last_name: event.target.value })} />
            <Input label="Phone" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} />
            <Input label="Email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} />
            <Input className="md:col-span-2" label="Notes" value={newCustomer.notes} onChange={(event) => setNewCustomer({ ...newCustomer, notes: event.target.value })} />
          </div>
          <Button className="mt-4" onClick={saveCustomer}>Save Customer</Button>
        </Card>
      ) : null}
      <div className="flex gap-6 border-b border-slate-200">
        {["Customers", "Fleets"].map((tab, index) => (
          <button key={tab} disabled={index !== 0} className={`py-3 text-sm font-semibold ${index === 0 ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-400"}`}>{index === 0 ? tab : "Fleets Coming Soon"}</button>
        ))}
      </div>
      <Card className="p-5">
        <div className="relative">
          <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
          <Input inputSize="touch" className="pl-12 text-lg" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, phone, email, VIN, or plate..." />
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
          <Card className="p-4"><div className="text-sm text-slate-500">Total Customers</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.totalCustomers}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Imported</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.importedCustomers}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">With Vehicles</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.customersWithVehicles}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Recent</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.recentCustomers}</div></Card>
        </div>
      ) : null}
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
          <span>{hasSearchOrFilter ? `${resultCount} matching customer${resultCount === 1 ? "" : "s"}` : "Recent customers"}</span>
          {loading ? <span>Searching...</span> : null}
        </div>
        {customers.length === 0 ? (
          <EmptyState title={loading ? "Loading customers" : "No customers found"} message={hasSearchOrFilter ? "Try another name, phone, email, VIN, or plate." : "Recent customer records will appear here."} />
        ) : (
          <div className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <div key={customer.id} className="grid gap-3 px-5 py-4 text-sm hover:bg-slate-50 lg:grid-cols-[1fr_160px_220px_130px_150px_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-950">
                    {customer.first_name} {customer.last_name}
                    {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                  </div>
                  <div className="text-slate-500">{customer.notes ?? "No customer notes"}</div>
                </div>
                <div className="text-slate-700">{customer.phone}</div>
                <div className="text-slate-500">{customer.email ?? "-"}</div>
                <div className="text-slate-500">{customer.vehicle_count} vehicle{customer.vehicle_count === 1 ? "" : "s"}</div>
                <div className="text-slate-500">{customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : "No visits"}</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void openCustomer(customer)}>Open</Button>
                  <Button onClick={() => { setStartTicketContext({ customerId: customer.id, source: "customer_detail" }); onStartTicket?.(); }}>Start Ticket</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasSearchOrFilter && customers.length < resultCount ? (
          <div className="border-t border-slate-200 p-4 text-center">
            <Button variant="secondary" disabled={loading} onClick={() => loadCustomers(offset, true)}>Load More</Button>
          </div>
        ) : null}
      </Card>
      {selected ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-950">Customer Detail: {selected.first_name} {selected.last_name}</h2>
            <div className="flex gap-2">
              <Button onClick={() => { setStartTicketContext({ customerId: selected.id, source: "customer_detail" }); onStartTicket?.(); }}>Start Ticket</Button>
              <Button variant="danger" disabled>Delete Coming Soon</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input label="First name" value={editCustomer.first_name} onChange={(event) => setEditCustomer({ ...editCustomer, first_name: event.target.value })} />
            <Input label="Last name" value={editCustomer.last_name} onChange={(event) => setEditCustomer({ ...editCustomer, last_name: event.target.value })} />
            <Input label="Phone" value={editCustomer.phone} onChange={(event) => setEditCustomer({ ...editCustomer, phone: event.target.value })} />
            <Input label="Email" value={editCustomer.email} onChange={(event) => setEditCustomer({ ...editCustomer, email: event.target.value })} />
            <Input className="md:col-span-2" label="Notes" value={editCustomer.notes} onChange={(event) => setEditCustomer({ ...editCustomer, notes: event.target.value })} />
          </div>
          <Button className="mt-3" onClick={saveSelectedCustomer}>Save Customer</Button>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-bold text-slate-950">Vehicles ({vehicles.length})</div>
              <div className="mt-3 space-y-2 text-sm">{vehicles.map((vehicle) => <div key={vehicle.id}>{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")} · {vehicle.plate ?? vehicle.vin ?? "No ID"}</div>)}</div>
              <div className="mt-4 grid gap-2">
                <Input label="Year" value={newVehicle.year} onChange={(event) => setNewVehicle({ ...newVehicle, year: event.target.value })} />
                <Input label="Make" value={newVehicle.make} onChange={(event) => setNewVehicle({ ...newVehicle, make: event.target.value })} />
                <Input label="Model" value={newVehicle.model} onChange={(event) => setNewVehicle({ ...newVehicle, model: event.target.value })} />
                <Input label="VIN" value={newVehicle.vin} onChange={(event) => setNewVehicle({ ...newVehicle, vin: event.target.value })} />
                <Input label="Plate" value={newVehicle.plate} onChange={(event) => setNewVehicle({ ...newVehicle, plate: event.target.value.toUpperCase() })} />
                <Input label="Mileage" value={newVehicle.mileage} onChange={(event) => setNewVehicle({ ...newVehicle, mileage: event.target.value })} />
                <Button onClick={addVehicle}>Add Vehicle</Button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-bold text-slate-950">Tickets ({tickets.length})</div>
              <div className="mt-3 space-y-2 text-sm">
                <div>Total spent: <strong>{formatMoney(tickets.filter((ticket) => ticket.status === "completed").reduce((sum, ticket) => sum + ticket.total, 0))}</strong></div>
                <div>Last visit: <strong>{tickets[0]?.completed_at ? new Date(tickets[0].completed_at).toLocaleDateString() : "None"}</strong></div>
                {tickets.slice(0, 6).map((ticket) => <div key={ticket.id}>{ticket.status} · {formatMoney(ticket.total)} · {ticket.service_names ?? "Ticket"}</div>)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-bold text-slate-950">Service History ({history.length})</div>
              <div className="mt-3 space-y-2 text-sm">{history.slice(0, 8).map((entry) => <div key={entry.id}>{new Date(entry.service_date).toLocaleDateString()} · {entry.mileage.toLocaleString()} mi · {entry.oil_type ?? "Service"}</div>)}</div>
            </div>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
