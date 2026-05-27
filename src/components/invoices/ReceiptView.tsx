import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { defaultBusinessProfile, getBusinessProfile, type BusinessProfile } from "../../lib/config/businessProfile";
import { formatMoney } from "../../lib/utils/money";
import type { Payment } from "../../types/payment";
import type { TicketWithDetails } from "../../types/ticket";

function formatTaxRate(rate: number) {
  return `${(Number.isFinite(rate) ? rate * 100 : 0).toFixed(2)}%`;
}

export function ReceiptView({ ticket, payments }: { ticket: TicketWithDetails; payments: Payment[] }) {
  const [profile, setProfile] = useState<BusinessProfile>(defaultBusinessProfile);
  const paid = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0);
  useEffect(() => {
    getBusinessProfile().then(setProfile).catch(() => setProfile(defaultBusinessProfile));
  }, []);
  return (
    <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-5">
      <h3 className="text-lg font-black text-[var(--pos-text)]">Receipt</h3>
      <div className="mt-4 max-w-md rounded-2xl bg-white p-5 text-sm text-slate-950">
        <div className="text-center">
          <div className="text-xl font-black">{profile.business_name}</div>
          <div className="text-xs text-slate-500">{new Date(ticket.completed_at ?? ticket.created_at).toLocaleString()}</div>
          <div className="text-xs text-slate-500">Ticket {ticket.external_id ?? ticket.id}</div>
        </div>
        <div className="mt-4 border-y border-slate-200 py-3">
          {ticket.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 py-1">
              <span>{item.name} × {item.quantity}</span>
              <span>{formatMoney(item.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between"><span>Taxable Subtotal</span><span>{formatMoney(ticket.taxable_subtotal)}</span></div>
          <div className="flex justify-between"><span>{`Sales Tax (${formatTaxRate(ticket.tax_rate ?? 0)})`}</span><span>{formatMoney(ticket.tax_total)}</span></div>
          <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatMoney(ticket.total)}</span></div>
          <div className="flex justify-between"><span>Paid</span><span>{formatMoney(paid)}</span></div>
          <div className="flex justify-between"><span>Balance</span><span>{formatMoney(Math.max(ticket.total - paid, 0))}</span></div>
        </div>
        <div className="mt-4 text-center text-xs text-slate-500">{profile.receipt_footer}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>Print Receipt</Button>
      </div>
    </div>
  );
}
