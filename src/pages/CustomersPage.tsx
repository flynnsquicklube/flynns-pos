import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { CustomerProfileDrawer, type CustomerProfileTab } from "../components/customers/CustomerProfileDrawer";
import {
  countCustomerSearchResults,
  createCustomer,
  getCustomerById,
  getCustomerStats,
  searchCustomersAdvanced,
  updateCustomer,
  type CustomerQuickFilter,
  type CustomerSearchFilters,
  type CustomerSearchResult,
  type CustomerStats
} from "../lib/db/repositories/customersRepo";
import { searchVehicles } from "../lib/db/repositories/vehiclesRepo";
import { listTicketsWithDetails } from "../lib/db/repositories/ticketsRepo";
import { getServiceHistoryByCustomer } from "../lib/db/repositories/serviceHistoryRepo";
import { useToast } from "../components/ui/useToast";
import type { Customer } from "../types/customer";
import type { Vehicle } from "../types/vehicle";
import type { TicketWithDetails } from "../types/ticket";
import type { ServiceHistory } from "../types/serviceHistory";
import { setStartTicketContext } from "../lib/domain/startTicket/startTicketContext";
import { createCustomerCoupon, listCouponsByCustomer } from "../lib/db/repositories/couponsRepo";
import { listReferralRewardsByCustomer } from "../lib/db/repositories/referralsRepo";
import { adjustPunchCard, getPunchCardByVehicle, listPunchEvents, type VehiclePunchCard, type VehiclePunchEvent } from "../lib/db/repositories/punchCardsRepo";
import type { CustomerCouponRecord } from "../lib/domain/loyalty/couponRules";
import type { ReferralReward } from "../lib/domain/loyalty/referralRules";

interface CustomersPageProps {
  initialCustomerId?: string;
  onStartTicket?: () => void;
  onOpenTicket?: (ticketId: string) => void;
  onOpenVehicle?: (vehicleId: string) => void;
}

export function CustomersPage({ initialCustomerId, onStartTicket, onOpenTicket, onOpenVehicle }: CustomersPageProps) {
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
  const [coupons, setCoupons] = useState<CustomerCouponRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralReward[]>([]);
  const [punchCards, setPunchCards] = useState<Array<{ vehicle: Vehicle; card: VehiclePunchCard | null; events: VehiclePunchEvent[] }>>([]);
  const [profileDefaultTab, setProfileDefaultTab] = useState<CustomerProfileTab>("overview");
  const [manualCoupon, setManualCoupon] = useState({ title: "$10 Manual Coupon", amount: "10" });
  const [punchNote, setPunchNote] = useState("");
  const [newCustomer, setNewCustomer] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
  const [editCustomer, setEditCustomer] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
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
    if (!hasSearchOrFilter) {
      setCustomers([]);
      setResultCount(0);
      setOffset(0);
      if (!initialCustomerId) setSelected(null);
      setLoading(false);
      return;
    }
    const filters = filtersFor(activeFilter);
    const listPromise = searchCustomersAdvanced(query, filters, 25, nextOffset);
    const countPromise = countCustomerSearchResults(query, filters);
    Promise.all([listPromise, countPromise])
      .then(([rows, count]) => {
        setCustomers((current) => append ? [...current, ...rows] : rows);
        setResultCount(count);
        setOffset(nextOffset + rows.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load customers."))
      .finally(() => setLoading(false));
  }, [activeFilter, debouncedSearch, filtersFor, initialCustomerId]);

  const openCustomer = useCallback(async (customer: Customer, defaultTab: CustomerProfileTab = "overview") => {
    setSelected(customer);
    setProfileDefaultTab(defaultTab);
    setEditCustomer({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      email: customer.email ?? "",
      notes: customer.notes ?? ""
    });
    const [customerVehicles, customerTickets, serviceHistory, customerCoupons, customerReferrals] = await Promise.all([
      searchVehicles("", customer.id),
      listTicketsWithDetails({ includeCompletedTodayOnly: false }),
      getServiceHistoryByCustomer(customer.id),
      listCouponsByCustomer(customer.id),
      listReferralRewardsByCustomer(customer.id)
    ]);
    setVehicles(customerVehicles);
    setTickets(customerTickets.filter((ticket) => ticket.customer_id === customer.id));
    setHistory(serviceHistory);
    setCoupons(customerCoupons);
    setReferrals(customerReferrals);
    setPunchCards(await Promise.all(customerVehicles.map(async (vehicle) => ({ vehicle, card: await getPunchCardByVehicle(vehicle.id), events: await listPunchEvents(vehicle.id) }))));
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

  const addManualCoupon = async () => {
    if (!selected) return;
    const amount = Number(manualCoupon.amount);
    if (!manualCoupon.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify({ tone: "error", title: "Coupon details needed", message: "Enter a title and discount amount." });
      return;
    }
    await createCustomerCoupon({
      customer_id: selected.id,
      title: manualCoupon.title.trim(),
      description: "Manual local POS coupon.",
      discount_type: "fixed",
      discount_amount: amount,
      source: "manual"
    });
    notify({ tone: "success", title: "Coupon created", message: "Available on new and open tickets." });
    await openCustomer(selected);
  };

  const addPunch = async (vehicle: Vehicle) => {
    if (!selected) return;
    await adjustPunchCard({
      customerId: selected.id,
      vehicleId: vehicle.id,
      punchDelta: 1,
      note: punchNote.trim() || "Manual punch adjustment."
    });
    notify({ tone: "success", title: "Punch added", message: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle" });
    setPunchNote("");
    await openCustomer(selected, "punchCards");
  };

  const startTicketForCustomer = (vehicle?: Vehicle) => {
    if (!selected) return;
    setStartTicketContext({ customerId: selected.id, vehicleId: vehicle?.id, source: vehicle ? "vehicle_detail" : "customer_detail" });
    onStartTicket?.();
  };

  const startTicketForSearchResult = (customer: CustomerSearchResult) => {
    setStartTicketContext({ customerId: customer.id, source: "customer_detail" });
    onStartTicket?.();
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
        <PageHeader theme="cyan" className="flex-1" title="Customers" subtitle="Search customer records, linked vehicles, and service history." />
        <div className="flex gap-2">
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
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Total Customers</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.totalCustomers}</div></Card>
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Imported</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.importedCustomers}</div></Card>
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">With Vehicles</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.customersWithVehicles}</div></Card>
          <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Recent</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.recentCustomers}</div></Card>
        </div>
      ) : null}
      {!hasSearchOrFilter ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-blue-2)]">
            <Search size={24} />
          </div>
          <h2 className="mt-4 text-xl font-black text-[var(--pos-text)]">Search to view customers</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--pos-muted)]">
            Enter a name, phone number, email, VIN, or plate to find customer records.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Badge tone="blue">Search by phone</Badge>
            <Badge tone="blue">Search by plate</Badge>
            <Badge tone="blue">Search by VIN</Badge>
          </div>
        </Card>
      ) : null}
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      {hasSearchOrFilter ? <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-5 py-3 text-sm text-[var(--pos-muted)]">
          <span>{resultCount} matching customer{resultCount === 1 ? "" : "s"}</span>
          {loading ? <span>Searching...</span> : null}
        </div>
        {customers.length === 0 ? (
          <EmptyState title={loading ? "Loading customers" : "No customers found"} message={hasSearchOrFilter ? "Try another name, phone, email, VIN, or plate." : "Recent customer records will appear here."} />
        ) : (
          <div className="divide-y divide-[var(--pos-border)]">
            {customers.map((customer) => (
              <div key={customer.id} className="grid gap-3 px-5 py-4 text-sm hover:bg-[var(--pos-panel-2)] lg:grid-cols-[1fr_160px_220px_130px_150px_auto] lg:items-center">
                <button type="button" className="text-left" onClick={() => void openCustomer(customer)}>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-[var(--pos-text)]">
                    {customer.first_name} {customer.last_name}
                    {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                    {customer.open_ticket_count ? <Badge tone="yellow">{customer.open_ticket_count} open</Badge> : null}
                  </div>
                  <div className="text-[var(--pos-muted)]">{customer.notes ?? "No customer notes"}</div>
                </button>
                <div className="text-[var(--pos-text)]">{customer.phone}</div>
                <div className="text-[var(--pos-muted)]">{customer.email ?? "-"}</div>
                <button type="button" className="text-left font-black text-[var(--pos-blue)] hover:underline" onClick={() => void openCustomer(customer, "vehicles")}>{customer.vehicle_count} vehicle{customer.vehicle_count === 1 ? "" : "s"}</button>
                <div className="text-[var(--pos-muted)]">{customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : "No visits"}</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void openCustomer(customer)}>Open</Button>
                  <Button onClick={() => startTicketForSearchResult(customer)}>Start Ticket</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasSearchOrFilter && customers.length < resultCount ? (
          <div className="border-t border-[var(--pos-border)] p-4 text-center">
            <Button variant="secondary" disabled={loading} onClick={() => loadCustomers(offset, true)}>Load More</Button>
          </div>
        ) : null}
      </Card> : null}
      {selected ? (
        <CustomerProfileDrawer
          customer={selected}
          vehicles={vehicles}
          tickets={tickets}
          history={history}
          coupons={coupons}
          referrals={referrals}
          punchCards={punchCards}
          defaultTab={profileDefaultTab}
          editCustomer={editCustomer}
          manualCoupon={manualCoupon}
          punchNote={punchNote}
          onEditCustomerChange={setEditCustomer}
          onManualCouponChange={setManualCoupon}
          onPunchNoteChange={setPunchNote}
          onClose={() => setSelected(null)}
          onSaveCustomer={saveSelectedCustomer}
          onStartTicket={startTicketForCustomer}
          onOpenVehicle={onOpenVehicle}
          onOpenTicket={onOpenTicket}
          onAddVehicle={() => startTicketForCustomer()}
          onAssignCoupon={addManualCoupon}
          onAddPunch={(vehicle) => void addPunch(vehicle)}
        />
      ) : null}
    </section>
  );
}
