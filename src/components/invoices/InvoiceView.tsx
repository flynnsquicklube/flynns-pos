import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { defaultBusinessProfile, getBusinessProfile, type BusinessProfile } from "../../lib/config/businessProfile";
import { formatMoney } from "../../lib/utils/money";
import type { Payment } from "../../types/payment";
import type { TicketWithDetails } from "../../types/ticket";

interface InvoiceViewProps {
  ticket: TicketWithDetails;
  payments: Payment[];
}

function customerName(ticket: TicketWithDetails) {
  return [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
}

function vehicleName(ticket: TicketWithDetails) {
  return [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
}

function formatTaxRate(rate: number) {
  return `${(Number.isFinite(rate) ? rate * 100 : 0).toFixed(2)}%`;
}

export function InvoiceView({ ticket, payments }: InvoiceViewProps) {
  const [profile, setProfile] = useState<BusinessProfile>(defaultBusinessProfile);
  const paid = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(ticket.total - paid, 0);
  const address = [profile.address_line_1, profile.address_line_2, profile.city, profile.state, profile.zip].filter(Boolean).join(", ");
  useEffect(() => {
    getBusinessProfile().then(setProfile).catch(() => setProfile(defaultBusinessProfile));
  }, []);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white text-slate-950">
      <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 p-6">
        <div>
          <div className="text-2xl font-black">{profile.business_name}</div>
          <div className="mt-1 text-sm text-slate-500">{address}</div>
          <div className="text-sm text-slate-500">Service invoice</div>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div className="font-bold text-slate-950">Invoice {ticket.external_id ?? ticket.id}</div>
          <div>{new Date(ticket.created_at).toLocaleString()}</div>
          <div>{ticket.completed_at ? `Completed ${new Date(ticket.completed_at).toLocaleString()}` : "Open invoice"}</div>
        </div>
      </div>
      <div className="grid gap-4 bg-slate-50 p-6 md:grid-cols-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</div>
          <div className="mt-2 font-bold">{customerName(ticket)}</div>
          <div className="text-sm text-slate-600">{ticket.customer_phone ?? "No phone"} · {ticket.customer_email ?? "No email"}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle</div>
          <div className="mt-2 font-bold">{vehicleName(ticket)}</div>
          <div className="text-sm text-slate-600">VIN {ticket.vehicle_vin ?? "-"} · Plate {ticket.vehicle_plate ?? "-"} · Mileage {ticket.vehicle_mileage?.toLocaleString() ?? "-"}</div>
        </div>
      </div>
      <div className="p-6">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="py-2">Services and Parts</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit</th><th className="py-2 text-right">Total</th></tr>
          </thead>
          <tbody>
            {ticket.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-3 font-medium">{item.name}</td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right">{formatMoney(item.unit_price)}</td>
                <td className="py-3 text-right font-bold">{formatMoney(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 ml-auto max-w-sm space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(ticket.subtotal)}</span></div>
          <div className="flex justify-between"><span>Taxable Subtotal</span><span>{formatMoney(ticket.taxable_subtotal)}</span></div>
          <div className="flex justify-between"><span>{`Sales Tax (${formatTaxRate(ticket.tax_rate ?? 0)})`}</span><span>{formatMoney(ticket.tax_total)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>{formatMoney(ticket.discount_total)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-black"><span>Total</span><span>{formatMoney(ticket.total)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span>{formatMoney(paid)}</span></div>
          <div className="flex justify-between text-lg font-black"><span>Balance Due</span><span>{formatMoney(balance)}</span></div>
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {ticket.customer_concern || ticket.technician_notes || ticket.internal_notes || profile.invoice_footer}
        </div>
        <div className="mt-5 flex flex-wrap gap-3 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}>Print Invoice</Button>
        </div>
      </div>
    </div>
  );
}
