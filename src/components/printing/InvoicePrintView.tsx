import type { InvoicePayload } from "../../lib/printing/printTypes";
import type { PaymentMethod } from "../../types/payment";
import { ModernInvoicePreview } from "../invoices/ModernInvoicePreview";

function toPaymentMethod(method: string): PaymentMethod {
  if (method === "Cash" || method === "Card" || method === "Check" || method === "Other") return method;
  return "Other";
}

export function InvoicePrintView({ payload }: { payload: InvoicePayload }) {
  return (
    <ModernInvoicePreview
      ticket={payload.ticket}
      businessProfile={payload.business}
      invoiceNumber={payload.invoiceNumber}
      employeeName="Brandon Flynn"
      payments={payload.payments.map((payment, index) => ({
        id: `print-payment-${index}`,
        ticket_id: payload.ticket.id,
        method: toPaymentMethod(payment.method),
        payment_subtype: payment.method,
        amount: payment.amount,
        status: "paid",
        reference: payment.reference ?? null,
        memo: null,
        paid_at: payment.paidAt,
        created_at: payment.paidAt,
        updated_at: payment.paidAt,
        deleted_at: null,
        sync_status: "pending"
      }))}
      paidAmount={payload.paidTotal}
      balanceDue={payload.balanceDue}
      displayPaymentStatus={payload.balanceDue <= 0 ? "paid" : payload.paidTotal > 0 ? "partially_paid" : "unpaid"}
      variant="print"
    />
  );
}
