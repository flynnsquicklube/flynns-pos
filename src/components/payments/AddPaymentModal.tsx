import { useMemo, useState } from "react";
import { formatMoney } from "../../lib/utils/money";
import type { PaymentMethod } from "../../types/payment";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type PaymentType = "Cash" | "Check" | "Credit" | "Debit" | "eTransfer" | "Warranty" | "Gift Card" | "ACH" | "Other";

interface AddPaymentModalProps {
  total: number;
  paid: number;
  ticketStatus: string;
  customerName?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  invoiceNumber?: string;
  loading?: boolean;
  onClose: () => void;
  onSave: (input: {
    amount: number;
    method: PaymentMethod;
    payment_subtype: string | null;
    reference: string | null;
    memo: string | null;
    finalize: boolean;
  }) => Promise<void>;
}

const paymentTypes: PaymentType[] = ["Cash", "Check", "Credit", "Debit", "eTransfer", "Warranty", "Gift Card", "ACH", "Other"];

function mapPaymentType(type: PaymentType): { method: PaymentMethod; subtype: string | null } {
  if (type === "Cash") return { method: "Cash", subtype: null };
  if (type === "Check") return { method: "Check", subtype: null };
  if (type === "Credit" || type === "Debit") return { method: "Card", subtype: type };
  if (type === "Other") return { method: "Other", subtype: null };
  return { method: "Other", subtype: type };
}

export function AddPaymentModal({
  total,
  paid,
  ticketStatus,
  customerName = "Customer",
  customerEmail,
  customerPhone,
  invoiceNumber,
  loading = false,
  onClose,
  onSave
}: AddPaymentModalProps) {
  const balanceDue = Math.max(total - paid, 0);
  const [amount, setAmount] = useState(balanceDue ? String(balanceDue.toFixed(2)) : "");
  const [paymentType, setPaymentType] = useState<PaymentType>("Cash");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [finalize, setFinalize] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNumber = Number(amount) || 0;
  const remaining = Math.max(balanceDue - amountNumber, 0);
  const changeDue = paymentType === "Cash" && amountNumber > balanceDue ? amountNumber - balanceDue : 0;
  const paidAfterPayment = paid + amountNumber;
  const willBePaid = paidAfterPayment + 0.00001 >= total;
  const canPay = useMemo(() => ticketStatus !== "canceled" && ticketStatus !== "completed" && amountNumber > 0, [amountNumber, ticketStatus]);

  const save = async () => {
    setError(null);
    if (!canPay) {
      setError(ticketStatus === "completed" ? "Completed tickets are locked." : ticketStatus === "canceled" ? "Canceled tickets cannot accept payment." : "Enter a payment amount greater than zero.");
      return;
    }
    if (finalize && !willBePaid) {
      setError("Finalize requires the invoice to be paid in full.");
      return;
    }
    const mapped = mapPaymentType(paymentType);
    try {
      await onSave({
        amount: amountNumber,
        method: mapped.method,
        payment_subtype: mapped.subtype,
        reference: reference.trim() || null,
        memo: memo.trim() || null,
        finalize
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save payment.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-slate-200 bg-slate-100 shadow-2xl">
        <div className="border-b border-slate-200 bg-white px-7 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Add Payment</h2>
              <p className="mt-1 text-sm text-slate-500">{invoiceNumber ? `Invoice ${invoiceNumber}` : "Manual payment recording"}</p>
            </div>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Payment Amount</div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              {editingAmount ? (
                <Input className="max-w-xs" label="Amount" inputSize="touch" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              ) : (
                <div className="text-5xl font-black text-slate-950">{formatMoney(amountNumber)}</div>
              )}
              <Button variant="secondary" onClick={() => setEditingAmount((value) => !value)}>{editingAmount ? "Done" : "Edit"}</Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Order Total</div><div className="mt-1 text-2xl font-black text-slate-950">{formatMoney(total)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Already Paid</div><div className="mt-1 text-2xl font-black text-slate-950">{formatMoney(paid)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Balance After Payment</div><div className="mt-1 text-2xl font-black text-[var(--pos-blue)]">{formatMoney(remaining)}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Payment From</div><div className="mt-1 text-xl font-black text-slate-950">{customerName}</div></div>
            </div>

            {changeDue > 0 ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-lg font-black text-emerald-700">Change Due: {formatMoney(changeDue)}</div>
            ) : null}
          </section>

          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-black text-slate-950">Finalize Order?</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFinalize(false)} className={`min-h-12 rounded-xl border text-sm font-black ${!finalize ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]" : "border-slate-200 bg-white text-slate-600"}`}>No</button>
                <button type="button" onClick={() => setFinalize(true)} className={`min-h-12 rounded-xl border text-sm font-black ${finalize ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]" : "border-slate-200 bg-white text-slate-600"}`}>Yes</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Default is No. Choose Yes only when the invoice is paid and ready to complete.</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-black text-slate-950">Payment Method</div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {paymentTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={`min-h-[58px] rounded-2xl border px-2 text-sm font-black transition ${paymentType === type ? "border-[var(--pos-blue)] bg-[var(--pos-blue)] text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-[var(--pos-blue)] hover:bg-[var(--pos-blue-soft)]"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-black text-slate-950">Reference & Memo</div>
              <p className="mt-1 text-sm text-slate-500">Selected method: <strong className="text-slate-800">{paymentType}</strong></p>
              <Input className="mt-3" label="Reference optional" inputSize="touch" value={reference} onChange={(event) => setReference(event.target.value)} />
              <Input className="mt-3" label="Memo optional" inputSize="touch" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </div>

            {(customerEmail || customerPhone) ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
                <div className="font-black text-slate-950">Customer Contact</div>
                {customerEmail ? <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-slate-500">Email on file: <strong className="text-slate-700">{customerEmail}</strong></div> : null}
                {customerPhone ? <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-slate-500">Phone on file: <strong className="text-slate-700">{customerPhone}</strong></div> : null}
              </div>
            ) : null}
          </section>
        </div>

        {error ? <div className="mx-6 mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-7 py-5">
          <Button className="min-w-40" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button className="min-w-56" size="touch" disabled={loading || !canPay} onClick={save}>{loading ? "Saving..." : finalize ? "Complete Payment & Finalize" : "Complete Payment"}</Button>
        </div>
      </div>
    </div>
  );
}
