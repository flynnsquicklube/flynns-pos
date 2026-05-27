import { Search, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import type { Customer } from "../../types/customer";
import type { WizardCustomerForm } from "./orderWizardTypes";

interface CustomerFleetStepProps {
  search: string;
  matches: Customer[];
  selectedCustomer: Customer | null;
  form: WizardCustomerForm;
  fleetEnabled: boolean;
  validation: string | null;
  onSearchChange: (value: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  onFormChange: (form: WizardCustomerForm) => void;
  onFleetChange: (enabled: boolean) => void;
  onSaveCustomer: () => Promise<void> | void;
  onPrevious: () => void;
  onNext: () => void;
}

export function CustomerFleetStep(props: CustomerFleetStepProps) {
  const [showAdd, setShowAdd] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const update = (key: keyof WizardCustomerForm, value: string) => props.onFormChange({ ...props.form, [key]: value });
  const hasSearch = props.search.trim().length >= 2;
  const showResults = hasSearch && !props.selectedCustomer;

  const saveCustomer = async () => {
    if (!props.form.first_name.trim() || !props.form.last_name.trim() || !props.form.phone.trim()) return;
    try {
      await props.onSaveCustomer();
      setShowAdd(false);
    } catch {
      setShowAdd(true);
    }
  };

  const cancelAdd = () => {
    setShowAdd(false);
    props.onFormChange({ first_name: "", last_name: "", phone: "", email: "", notes: "" });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-6xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--pos-text)]">Customer / Fleet</h1>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Attach this order to an existing customer or create a local customer record.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={props.onPrevious}>Previous</Button>
            <Button icon={<UserPlus size={16} />} onClick={() => setShowAdd(true)}>Add Customer</Button>
          </div>
        </div>
        {props.validation ? <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--pos-danger)]">{props.validation}</div> : null}
        <div className="mt-6">
          <div className="relative">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
            <Input ref={inputRef} inputSize="touch" className="pl-12 text-lg" placeholder="Search customer name, phone, or email..." value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} />
          </div>
          <div className="mt-2 text-sm text-[var(--pos-muted)]">
            {hasSearch ? `${props.matches.length} matching customer${props.matches.length === 1 ? "" : "s"}` : "Enter at least 2 characters to search customers."}
          </div>
        </div>

        <div className={`mt-6 grid gap-5 ${showAdd || props.selectedCustomer ? "xl:grid-cols-[1fr_420px]" : ""}`}>
          <div className="space-y-3">
            {!hasSearch && !props.selectedCustomer ? (
              <EmptyState
                title="Search for a customer"
                message="Enter a name, phone number, or email to find an existing customer."
                action={<div className="flex flex-wrap justify-center gap-2"><Badge tone="blue">Name</Badge><Badge tone="blue">Phone</Badge><Badge tone="blue">Email</Badge></div>}
              />
            ) : null}
            {hasSearch && props.matches.length === 0 && !props.selectedCustomer ? <EmptyState title="No customers found" message="Try another name, phone number, or email, or add a new customer." /> : null}
            {showResults ? props.matches.map((customer) => (
              <button key={customer.id} onClick={() => props.onSelectCustomer(customer)} className="w-full rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-left transition hover:border-[var(--pos-blue)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-black text-[var(--pos-text)]">
                      {customer.first_name} {customer.last_name}
                      {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{customer.phone} {customer.email ? `- ${customer.email}` : ""}</div>
                  </div>
                  <span className="rounded-full bg-[var(--pos-blue)] px-3 py-1 text-xs font-black text-white">Select</span>
                </div>
              </button>
            )) : null}
            {props.selectedCustomer ? (
              <div className="rounded-2xl border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-black text-[var(--pos-text)]">
                      {props.selectedCustomer.first_name} {props.selectedCustomer.last_name}
                      {props.selectedCustomer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{props.selectedCustomer.phone} {props.selectedCustomer.email ? `- ${props.selectedCustomer.email}` : ""}</div>
                  </div>
                  <Badge tone="green">Selected</Badge>
                </div>
              </div>
            ) : null}
          </div>

          {showAdd ? (
            <div className="grid gap-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
              <div>
                <h2 className="text-lg font-black text-[var(--pos-text)]">Add Customer</h2>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Create a local customer record for this ticket.</p>
              </div>
              <Input label="First name" required placeholder="First name" value={props.form.first_name} onChange={(event) => update("first_name", event.target.value)} />
              <Input label="Last name" required placeholder="Last name" value={props.form.last_name} onChange={(event) => update("last_name", event.target.value)} />
              <Input label="Phone" required placeholder="Phone" value={props.form.phone} onChange={(event) => update("phone", event.target.value)} />
              <Input label="Email" placeholder="Optional" value={props.form.email} onChange={(event) => update("email", event.target.value)} />
              <Input label="Notes" placeholder="Optional" value={props.form.notes} onChange={(event) => update("notes", event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={cancelAdd}>Cancel</Button>
                <Button disabled={!props.form.first_name.trim() || !props.form.last_name.trim() || !props.form.phone.trim()} onClick={() => void saveCustomer()}>Save Customer</Button>
              </div>
            </div>
          ) : null}

          {!showAdd && props.selectedCustomer ? (
            <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-5">
              <h2 className="text-xl font-black text-[var(--pos-text)]">Selected Customer</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">{props.selectedCustomer.first_name} {props.selectedCustomer.last_name}</p>
              <div className="mt-4 space-y-2 text-sm text-[var(--pos-muted)]">
                <div>Phone: <span className="font-semibold text-[var(--pos-text)]">{props.selectedCustomer.phone}</span></div>
                {props.selectedCustomer.email ? <div>Email: <span className="font-semibold text-[var(--pos-text)]">{props.selectedCustomer.email}</span></div> : null}
              </div>
              <Button className="mt-5 w-full" onClick={props.onNext}>Continue</Button>
            </div>
          ) : null}
        </div>
        <div className="mt-8 flex justify-end">
          <Button disabled={!props.selectedCustomer} onClick={props.onNext}>Next</Button>
        </div>
      </Card>
    </div>
  );
}
