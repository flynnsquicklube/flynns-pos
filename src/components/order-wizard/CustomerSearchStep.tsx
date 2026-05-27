import { AlertTriangle, Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { countCustomerSearchResults, createCustomer, searchCustomersAdvanced, type CustomerSearchResult } from "../../lib/db/repositories/customersRepo";
import { listVehiclesByCustomerId, type VehicleSearchResult } from "../../lib/db/repositories/vehiclesRepo";
import type { Customer } from "../../types/customer";
import { useToast } from "../ui/useToast";

type CustomerFlowStep = "findCustomer" | "addCustomer" | "selectVehicle" | "enterMileage";

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
  const [flowStep, setFlowStep] = useState<CustomerFlowStep>(selectedCustomer ? "selectVehicle" : "findCustomer");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleSearchResult[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSearchResult | null>(null);
  const [currentMileage, setCurrentMileage] = useState("");
  const [lowerMileageConfirmed, setLowerMileageConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { notify } = useToast();

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
      setSelectedVehicle(null);
      setCurrentMileage("");
      setLowerMileageConfirmed(false);
      setFlowStep((current) => current === "addCustomer" ? current : "findCustomer");
      return;
    }
    setSelectedVehicle(null);
    setCurrentMileage("");
    setLowerMileageConfirmed(false);
    setFlowStep("selectVehicle");
    loadVehicles(selectedCustomer);
  }, [loadVehicles, selectedCustomer]);

  useEffect(() => {
    if (!selectedVehicleId) return;
    const matchingVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    if (matchingVehicle) setSelectedVehicle(matchingVehicle);
  }, [selectedVehicleId, vehicles]);

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
    setSelectedVehicle(null);
    setCurrentMileage("");
    setLowerMileageConfirmed(false);
    onSelectCustomer(customer);
    loadVehicles(customer);
    setFlowStep("selectVehicle");
  };

  const selectVehicle = (vehicle: VehicleSearchResult) => {
    setSelectedVehicle(vehicle);
    setCurrentMileage("");
    setLowerMileageConfirmed(false);
    setError(null);
    setFlowStep("enterMileage");
  };

  const backToVehicles = () => {
    setSelectedVehicle(null);
    setCurrentMileage("");
    setLowerMileageConfirmed(false);
    setError(null);
    setFlowStep("selectVehicle");
  };

  const parsedMileage = Number(currentMileage);
  const hasValidMileage = Number.isFinite(parsedMileage) && parsedMileage > 0;
  const lowerThanLastMileage = Boolean(selectedVehicle?.mileage && hasValidMileage && parsedMileage < selectedVehicle.mileage);
  const canUseSelectedVehicle = Boolean(selectedVehicle && hasValidMileage && (!lowerThanLastMileage || lowerMileageConfirmed));

  const useSelectedVehicle = () => {
    if (!selectedVehicle) return;
    if (!hasValidMileage) {
      setError("Enter current mileage before using this vehicle.");
      return;
    }
    if (lowerThanLastMileage && !lowerMileageConfirmed) {
      setError("Confirm the lower mileage before continuing.");
      return;
    }
    onUseVehicle({ ...selectedVehicle, mileage: parsedMileage });
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
      setForm({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
      selectCustomer(selected);
      notify({ tone: "success", title: "Customer saved", message: `${customer.first_name} ${customer.last_name} selected.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create customer.");
    }
  };

  const cancelAdd = () => {
    setFlowStep("findCustomer");
    setForm({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectedCustomerName = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : "";

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-5xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--pos-text)]">
              {flowStep === "findCustomer" ? "Find Customer" : flowStep === "addCustomer" ? "Add Customer" : flowStep === "selectVehicle" ? "Select Vehicle" : "Confirm Arrival Mileage"}
            </h1>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">
              {flowStep === "findCustomer" ? "Search by name, phone number, email, VIN, or plate." : flowStep === "addCustomer" ? "Create a local customer record for this ticket." : flowStep === "selectVehicle" ? `Choose a vehicle for ${selectedCustomerName}.` : "Confirm the mileage the vehicle arrived with today."}
            </p>
          </div>
          <div className="flex gap-2">
            {flowStep === "findCustomer" ? <Button variant="secondary" onClick={onBack}>Back</Button> : null}
            {flowStep === "addCustomer" ? <Button variant="secondary" onClick={cancelAdd}>Back</Button> : null}
            {flowStep === "selectVehicle" ? <Button variant="secondary" onClick={() => setFlowStep("findCustomer")}>Back to Customer Search</Button> : null}
            {flowStep === "enterMileage" ? <Button variant="secondary" onClick={backToVehicles}>Back to Vehicles</Button> : null}
            {flowStep === "findCustomer" ? <Button icon={<UserPlus size={16} />} onClick={() => setFlowStep("addCustomer")}>Add Customer</Button> : null}
            {flowStep === "selectVehicle" ? <Button variant="secondary" disabled={!selectedCustomer} onClick={onAddVehicleForCustomer}>Add Vehicle</Button> : null}
          </div>
        </div>
        {validation || error ? <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--pos-danger)]">{validation ?? error}</div> : null}

        {flowStep === "findCustomer" ? (
          <div className="mt-6 space-y-5">
            <div>
              <div className="relative">
                <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
                <Input ref={inputRef} inputSize="touch" className="pl-12 text-lg" placeholder="Search customer name, phone, email, VIN, or plate..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="mt-2 text-sm text-[var(--pos-muted)]">
                {search.trim().length < 2 ? "Start typing to search customers." : loading ? "Searching..." : `${resultCount} matching customer${resultCount === 1 ? "" : "s"}`}
              </div>
            </div>
            {search.trim().length < 2 ? (
              <EmptyState
                title="Search for a customer"
                message="Enter a name, phone number, email, VIN, or plate to find an existing customer."
              />
            ) : null}
            {search.trim().length >= 2 && !loading && results.length === 0 ? <EmptyState title="No Results" message="No customer matched that search." /> : null}
            {results.map((customer) => (
              <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className="w-full rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-left transition hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-black text-[var(--pos-text)]">
                      {customer.first_name} {customer.last_name}
                      {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{customer.phone} · {customer.email ?? "No email"}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{customer.vehicle_count} vehicle{customer.vehicle_count === 1 ? "" : "s"} · Last visit {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : "none"}</div>
                  </div>
                  <span className="rounded-full bg-[var(--pos-blue)] px-3 py-1 text-xs font-black text-white">Select</span>
                </div>
              </button>
            ))}
            {results.length < resultCount ? <Button variant="secondary" disabled={loading} onClick={() => runSearch(offset, true)}>Load More</Button> : null}
          </div>
        ) : null}

        {flowStep === "addCustomer" ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-5">
              <Input label="First name" required value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
              <Input label="Last name" required value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
              <Input label="Phone" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <Input label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <Input label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={cancelAdd}>Cancel</Button>
                <Button disabled={!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()} onClick={() => void saveCustomer()}>Save Customer</Button>
              </div>
          </div>
        ) : null}

        {flowStep === "selectVehicle" && selectedCustomer ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-black text-[var(--pos-text)]">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                    {selectedCustomer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                  </div>
                  <div className="mt-1 text-sm text-[var(--pos-muted)]">{selectedCustomer.phone} {selectedCustomer.email ? `- ${selectedCustomer.email}` : ""}</div>
                </div>
                <Badge tone="green">Selected Customer</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
              <div className="space-y-3">
                    {vehicleLoading ? <div className="text-sm text-[var(--pos-muted)]">Loading vehicles...</div> : null}
                    {!vehicleLoading && vehicles.length === 0 ? <EmptyState title="No vehicles found for this customer." message="Add a vehicle to continue to package selection." action={<Button onClick={onAddVehicleForCustomer}>Add Vehicle</Button>} /> : null}
                    {vehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => selectVehicle(vehicle)}
                        className={`w-full rounded-xl border p-3 text-left transition hover:border-[var(--pos-blue)] hover:bg-[var(--pos-blue-soft)] ${selectedVehicleId === vehicle.id ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-panel-2)]"}`}
                      >
                        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--pos-text)]">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                            <div className="mt-1 text-sm text-[var(--pos-muted)]">Previous oil type: {vehicle.oil_type ?? "Not set"}</div>
                          </div>
                          <div className="text-sm text-[var(--pos-muted)]">VIN {vehicle.vin ? vehicle.vin.slice(-8) : "-"}<br />Plate {vehicle.plate ?? "-"} {vehicle.plate_state ?? ""}</div>
                          <div className="text-sm text-[var(--pos-muted)]">Last mileage: {vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "Not recorded"}<br />Last visit: {vehicle.last_visit ? new Date(vehicle.last_visit).toLocaleDateString() : "none"}</div>
                          <span className="rounded-full bg-[var(--pos-blue)] px-3 py-1 text-xs font-black text-white">Select Vehicle</span>
                        </div>
                      </button>
                    ))}
              </div>
            </div>
          </div>
        ) : null}

        {flowStep === "enterMileage" && selectedVehicle ? (
          <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
                    <div className="font-black text-[var(--pos-text)]">{[selectedVehicle.year, selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ") || "Selected vehicle"}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">VIN {selectedVehicle.vin ? selectedVehicle.vin.slice(-8) : "-"} · Plate {selectedVehicle.plate ?? "-"} {selectedVehicle.plate_state ?? ""}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">Last service: {selectedVehicle.last_visit ? new Date(selectedVehicle.last_visit).toLocaleDateString() : "Not recorded"}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">Last recorded mileage: {selectedVehicle.mileage ? `${selectedVehicle.mileage.toLocaleString()} mi` : "Not recorded"}</div>
                  </div>
                  <Input
                    label="Current Mileage"
                    type="number"
                    inputSize="touch"
                    value={currentMileage}
                    onChange={(event) => {
                      setCurrentMileage(event.target.value);
                      setLowerMileageConfirmed(false);
                      setError(null);
                    }}
                    placeholder="Enter current mileage"
                    helperText={selectedVehicle.mileage ? `Last recorded: ${selectedVehicle.mileage.toLocaleString()} mi` : "No previous mileage recorded."}
                  />
                  {currentMileage.trim() && !hasValidMileage ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-[var(--pos-danger)]">Mileage must be greater than 0.</div>
                  ) : null}
                  {lowerThanLastMileage ? (
                    <label className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900">
                      <input
                        className="mt-1"
                        type="checkbox"
                        checked={lowerMileageConfirmed}
                        onChange={(event) => setLowerMileageConfirmed(event.target.checked)}
                      />
                      <span>
                        <span className="flex items-center gap-2 font-black"><AlertTriangle size={16} /> Current mileage is lower than the last recorded mileage.</span>
                        <span className="mt-1 block">Confirm mileage is correct.</span>
                      </span>
                    </label>
                  ) : null}
                  <Button className="w-full" size="touch" disabled={!canUseSelectedVehicle} onClick={useSelectedVehicle}>
                    Use This Vehicle
                  </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
