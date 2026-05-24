import { Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
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
  onPrevious: () => void;
  onNext: () => void;
}

export function CustomerFleetStep(props: CustomerFleetStepProps) {
  const update = (key: keyof WizardCustomerForm, value: string) => props.onFormChange({ ...props.form, [key]: value });

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-5xl p-8">
        <h1 className="text-2xl font-bold text-slate-950">Customer / Fleet</h1>
        <p className="mt-1 text-sm text-slate-500">Attach this order to an existing customer or create a local customer record.</p>
        {props.validation ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{props.validation}</div> : null}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Search existing customer</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
              <Input className="pl-9" placeholder="Name, phone, or email" value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} />
            </div>
            <div className="mt-4 space-y-2">
              {props.matches.slice(0, 6).map((customer) => (
                <button key={customer.id} onClick={() => props.onSelectCustomer(customer)} className={`w-full rounded-lg border p-3 text-left transition ${props.selectedCustomer?.id === customer.id ? "border-[var(--brand-primary)] bg-[var(--brand-primary-light)]" : "border-[var(--brand-border)] bg-white hover:border-[var(--brand-primary)]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-950">{customer.first_name} {customer.last_name}</span>
                    {props.selectedCustomer?.id === customer.id ? <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-xs font-bold text-white">Selected</span> : null}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{customer.phone} {customer.email ? `- ${customer.email}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-xl border border-[var(--brand-border)] bg-slate-50 p-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm font-semibold text-slate-700">Fleet placeholder</span>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={props.fleetEnabled} onChange={(event) => props.onFleetChange(event.target.checked)} />
                Fleet
              </label>
            </div>
            <label className="text-sm font-semibold text-slate-700">First name <span className="text-red-600">*</span><Input className="mt-2" placeholder="First name" value={props.form.first_name} onChange={(event) => update("first_name", event.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Last name <span className="text-red-600">*</span><Input className="mt-2" placeholder="Last name" value={props.form.last_name} onChange={(event) => update("last_name", event.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Phone <span className="text-red-600">*</span><Input className="mt-2" placeholder="Phone" value={props.form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Email<Input className="mt-2" placeholder="Optional" value={props.form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Notes<Input className="mt-2" placeholder="Optional" value={props.form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
          </div>
        </div>
        <div className="mt-8 flex justify-between">
          <Button variant="secondary" onClick={props.onPrevious}>Previous</Button>
          <Button onClick={props.onNext}>Next</Button>
        </div>
      </Card>
    </div>
  );
}
