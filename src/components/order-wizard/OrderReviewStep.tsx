import { Save } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { formatMoney } from "../../lib/utils/money";
import type { Customer } from "../../types/customer";
import type { TicketLineInput } from "../../types/ticket";
import type { TicketTotals } from "../../lib/utils/pricing";
import type { VehicleSpecsForm, WizardCustomerForm } from "./orderWizardTypes";

interface OrderReviewStepProps {
  specs: VehicleSpecsForm;
  selectedCustomer: Customer | null;
  customerForm: WizardCustomerForm;
  lines: TicketLineInput[];
  customerConcern: string;
  technicianNotes: string;
  internalNotes: string;
  totals: TicketTotals;
  validation: string | null;
  saving: boolean;
  onPrevious: () => void;
  onCreateOrder: () => void;
}

export function OrderReviewStep(props: OrderReviewStepProps) {
  const customerName = props.selectedCustomer
    ? `${props.selectedCustomer.first_name} ${props.selectedCustomer.last_name}`
    : `${props.customerForm.first_name} ${props.customerForm.last_name}`.trim();

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-5xl p-8">
        <div className="flex flex-wrap items-start gap-3">
          <Button variant="secondary" size="sm" onClick={props.onPrevious}>Back</Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Review Order</h1>
            <p className="mt-1 text-sm text-slate-500">Confirm vehicle, customer, servicing, and totals before check-in.</p>
          </div>
        </div>
        {props.validation ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{props.validation}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle</div>
            <div className="mt-2 text-lg font-bold text-slate-950">{[props.specs.year, props.specs.make, props.specs.model].filter(Boolean).join(" ")}</div>
            <div className="mt-1 text-sm text-slate-600">Mileage {Number(props.specs.mileage || 0).toLocaleString()} - Plate {props.specs.plate || "-"}</div>
            <div className="text-sm text-slate-600">VIN {props.specs.vin || "-"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</div>
            <div className="mt-2 text-lg font-bold text-slate-950">{customerName || "New customer"}</div>
            <div className="mt-1 text-sm text-slate-600">{props.selectedCustomer?.phone ?? props.customerForm.phone}</div>
            <div className="text-sm text-slate-600">{(props.selectedCustomer?.email ?? props.customerForm.email) || "No email"}</div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Service / Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.lines.map((line, index) => (
                <tr key={`${line.name}-${index}`}>
                  <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-950">{line.name}</td>
                  <td className="border-t border-slate-100 px-4 py-3 text-right">{line.quantity}</td>
                  <td className="border-t border-slate-100 px-4 py-3 text-right">{formatMoney(line.unit_price)}</td>
                  <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold">{formatMoney(line.quantity * line.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-bold text-slate-950">Notes</div>
            <p className="mt-2">Concern: {props.customerConcern || "None"}</p>
            <p>Tech: {props.technicianNotes || "None"}</p>
            <p>Internal: {props.internalNotes || "None"}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(props.totals.subtotal)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatMoney(props.totals.tax_total)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Discount</span><span>{formatMoney(props.totals.discount_total)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-2xl font-black text-slate-950"><span>Total</span><span>{formatMoney(props.totals.total)}</span></div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-between gap-3">
          <Button variant="secondary" onClick={props.onPrevious}>Previous</Button>
          <div className="flex gap-3">
            <Button icon={<Save size={16} />} disabled={props.saving} onClick={props.onCreateOrder}>
              {props.saving ? "Creating..." : "Check In / Create Order"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
