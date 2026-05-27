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
            <h1 className="text-2xl font-bold text-[var(--pos-text)]">Review Order</h1>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Confirm vehicle, customer, servicing, and totals before check-in.</p>
          </div>
        </div>
        {props.validation ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{props.validation}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--pos-muted)]">Vehicle</div>
            <div className="mt-2 text-lg font-bold text-[var(--pos-text)]">{[props.specs.year, props.specs.make, props.specs.model].filter(Boolean).join(" ")}</div>
            <div className="mt-1 text-sm text-[var(--pos-muted)]">Mileage {Number(props.specs.mileage || 0).toLocaleString()} - Plate {props.specs.plate || "-"}</div>
            <div className="text-sm text-[var(--pos-muted)]">VIN {props.specs.vin || "-"}</div>
          </div>
          <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--pos-muted)]">Customer</div>
            <div className="mt-2 text-lg font-bold text-[var(--pos-text)]">{customerName || "New customer"}</div>
            <div className="mt-1 text-sm text-[var(--pos-muted)]">{props.selectedCustomer?.phone ?? props.customerForm.phone}</div>
            <div className="text-sm text-[var(--pos-muted)]">{(props.selectedCustomer?.email ?? props.customerForm.email) || "No email"}</div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--pos-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--pos-panel-2)] text-left text-xs uppercase tracking-wide text-[var(--pos-muted)]">
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
                  <td className="border-t border-[var(--pos-border)] px-4 py-3 font-medium text-[var(--pos-text)]">{line.name}</td>
                  <td className="border-t border-[var(--pos-border)] px-4 py-3 text-right text-[var(--pos-muted)]">{line.quantity}</td>
                  <td className="border-t border-[var(--pos-border)] px-4 py-3 text-right text-[var(--pos-muted)]">{formatMoney(line.unit_price)}</td>
                  <td className="border-t border-[var(--pos-border)] px-4 py-3 text-right font-semibold text-[var(--pos-text)]">{formatMoney(line.quantity * line.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm text-[var(--pos-muted)]">
            <div className="font-bold text-[var(--pos-text)]">Notes</div>
            <p className="mt-2">Concern: {props.customerConcern || "None"}</p>
            <p>Tech: {props.technicianNotes || "None"}</p>
            <p>Internal: {props.internalNotes || "None"}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--pos-muted)]"><span>Subtotal</span><span>{formatMoney(props.totals.subtotal)}</span></div>
            <div className="flex justify-between text-[var(--pos-muted)]"><span>Tax</span><span>{formatMoney(props.totals.tax_total)}</span></div>
            <div className="flex justify-between text-[var(--pos-muted)]"><span>Discount</span><span>{formatMoney(props.totals.discount_total)}</span></div>
            <div className="flex justify-between border-t border-[var(--pos-border)] pt-3 text-2xl font-black text-[var(--pos-text)]"><span>Total</span><span>{formatMoney(props.totals.total)}</span></div>
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
