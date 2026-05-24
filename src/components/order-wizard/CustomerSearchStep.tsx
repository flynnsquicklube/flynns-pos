import { Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { countCustomerSearchResults, createCustomer, searchCustomersAdvanced, type CustomerSearchResult } from "../../lib/db/repositories/customersRepo";
import { listVehiclesByCustomerId, type VehicleSearchResult } from "../../lib/db/repositories/vehiclesRepo";
import type { Customer } from "../../types/customer";

interface CustomerSearchStepProps {
  selectedCustomer: Customer | null;
  selectedVehicleId: string | null;
  validation: string | null;
  onBack: () => void;
  onSelectCustomer: (customer: CustomerSearchResult) => void;
  onUseVehicle: (vehicle: VehicleSearchResult) => void;
  onAddVehicleForCustomer: () => void;
}

export function CustomerSearchStep({ selectedCustomer, selectedVehicleId, validation, onBack, onSelectCustomer, onUseVehicle, onAddVehicleForCustomer }: CustomerSearchStepProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleSearchResult[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadVehicles = useCallback((customer: Customer) => {
    setVehicleLoading(true);
    listVehiclesByCustomerId(customer.id)
      .then(setVehicles)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load customer vehicles."))
      .finally(() => setVehicleLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setVehicles([]);
      return;
    }
    loadVehicles(selectedCustomer);
  }, [loadVehicles, selectedCustomer]);

  const runSearch = useCallback((nextOffset = 0, append = false) => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      setResultCount(0);
      setOffset(0);
      return;
    }
    setLoading(true);
    Promise.all([searchCustomersAdvanced(query, {}, 25, nextOffset), countCustomerSearchResults(query, {})])
      .then(([rows, count]) => {
        setResults((current) => append ? [...current, ...rows] : rows);
        setResultCount(count);
        setOffset(nextOffset + rows.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to search customers."))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(0, false), 250);
    return () => window.clearTimeout(timer);
  }, [runSearch]);

  const selectCustomer = (customer: CustomerSearchResult) => {
    onSelectCustomer(customer);
    loadVehicles(customer);
  };

  const saveCustomer = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
      setError("First name, last name, and phone are required.");
      return;
    }
    try {
      const customer = await createCustomer({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        firebase_uid: null,
        referral_code: null
      });
      const selected: CustomerSearchResult = { ...customer, vehicle_count: 0, last_visit: null, open_ticket_count: 0 };
      setShowAdd(false);
      setForm({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
      selectCustomer(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create customer.");
    }
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-6xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--pos-text)]">Find Customer</h1>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Search by name, phone number, or email.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onBack}>Back</Button>
            <Button icon={<UserPlus size={16} />} onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Close" : "Add New Customer"}</Button>
          </div>
        </div>
        {validation || error ? <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--pos-danger)]">{validation ?? error}</div> : null}

        <div className="mt-6">
          <div className="relative">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
            <Input ref={inputRef} inputSize="touch" className="pl-12 text-lg" placeholder="Search customer name, phone, or email..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="mt-2 text-sm text-[var(--pos-muted)]">
            {search.trim().length < 2 ? "Start typing to search customers." : loading ? "Searching..." : `${resultCount} matching customer${resultCount === 1 ? "" : "s"}`}
          </div>
        </div>

        {showAdd ? (
          <div className="mt-5 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="First name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
              <Input label="Last name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
              <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <Input label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <Input className="md:col-span-2" label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </div>
            <Button className="mt-3" onClick={saveCustomer}>Save Customer</Button>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-3">
            {search.trim().length >= 2 && !loading && results.length === 0 ? <EmptyState title="No Results" message="No customer matched that search." /> : null}
            {results.map((customer) => (
              <div key={customer.id} className={`rounded-2xl border p-4 ${selectedCustomer?.id === customer.id ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-card)]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-black text-[var(--pos-text)]">
                      {customer.first_name} {customer.last_name}
                      {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{customer.phone} · {customer.email ?? "No email"}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{customer.vehicle_count} vehicle{customer.vehicle_count === 1 ? "" : "s"} · Last visit {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : "none"}</div>
                  </div>
                  <Button onClick={() => selectCustomer(customer)}>{selectedCustomer?.id === customer.id ? "Selected" : "Select Customer"}</Button>
                </div>
              </div>
            ))}
            {results.length < resultCount ? <Button variant="secondary" disabled={loading} onClick={() => runSearch(offset, true)}>Load More</Button> : null}
          </div>

          <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--pos-text)]">Select Vehicle</h2>
                <p className="text-sm text-[var(--pos-muted)]">{selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : "Select a customer first."}</p>
              </div>
              <Button variant="secondary" disabled={!selectedCustomer} onClick={onAddVehicleForCustomer}>Add Vehicle</Button>
            </div>
            {selectedCustomer ? (
              <div className="mt-4 space-y-3">
                {vehicleLoading ? <div className="text-sm text-[var(--pos-muted)]">Loading vehicles...</div> : null}
                {!vehicleLoading && vehicles.length === 0 ? <EmptyState title="No vehicles found" message="Add a vehicle for this customer to continue." /> : null}
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className={`rounded-xl border p-4 ${selectedVehicleId === vehicle.id ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-panel-2)]"}`}>
                    <div className="font-bold text-[var(--pos-text)]">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">VIN {vehicle.vin ?? "-"} · Plate {vehicle.plate ?? "-"} {vehicle.plate_state ?? ""}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "Mileage needed"} · {vehicle.oil_type ?? "Oil type not set"} · Last visit {vehicle.last_visit ? new Date(vehicle.last_visit).toLocaleDateString() : "none"}</div>
                    <Button className="mt-3" onClick={() => onUseVehicle(vehicle)}>Use This Vehicle</Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
