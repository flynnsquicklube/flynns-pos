import { Download, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { createCustomer, listCustomers } from "../lib/db/repositories/customersRepo";
import { useToast } from "../components/ui/useToast";
import type { Customer } from "../types/customer";

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const loadCustomers = () => {
    setLoading(true);
    listCustomers(search)
      .then(setCustomers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load customers."))
      .finally(() => setLoading(false));
  };

  useEffect(loadCustomers, [search]);

  const saveCustomer = async () => {
    if (!newCustomer.first_name.trim() || !newCustomer.last_name.trim() || !newCustomer.phone.trim()) {
      notify({ tone: "error", title: "Customer details needed", message: "First name, last name, and phone are required." });
      return;
    }
    await createCustomer({ ...newCustomer, email: newCustomer.email || null, notes: newCustomer.notes || null, firebase_uid: null, referral_code: null });
    notify({ tone: "success", title: "Customer saved", message: `${newCustomer.first_name} ${newCustomer.last_name}` });
    setShowAdd(false);
    setNewCustomer({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
    loadCustomers();
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Customers & Fleets</h1>
          <p className="text-sm text-slate-500">Search customers, vehicles, and fleet accounts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download size={16} />}>Export Customers</Button>
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
          <button key={tab} className={`py-3 text-sm font-semibold ${index === 0 ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-500"}`}>{tab}</button>
        ))}
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            <option>All</option>
          </select>
          <div className="relative min-w-72 flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={17} />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Email, Phone Number, License Plate" />
          </div>
          <Button variant="secondary">View Details</Button>
        </div>
      </Card>
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      <Card className="overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState title={loading ? "Loading customers" : "No customers"} message="Customer records from SQLite will appear here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <div key={customer.id} className="grid gap-3 px-5 py-4 text-sm hover:bg-slate-50 md:grid-cols-[1fr_160px_220px_auto] md:items-center">
                <div>
                  <div className="font-semibold text-slate-950">{customer.first_name} {customer.last_name}</div>
                  <div className="text-slate-500">{customer.notes ?? "No customer notes"}</div>
                </div>
                <div className="text-slate-700">{customer.phone}</div>
                <div className="text-slate-500">{customer.email ?? "-"}</div>
                <Button variant="secondary">View Details</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
