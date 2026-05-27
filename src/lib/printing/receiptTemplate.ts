import { formatMoney } from "../utils/money";
import flynnsLogoUrl from "../../assets/brand/flynns-quick-lube-logo.png";
import type { ReceiptPayload } from "./printTypes";

export function renderReceiptHtml(payload: ReceiptPayload): string {
  const customer = [payload.ticket.customer_first_name, payload.ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
  return `
    <section class="receipt-print">
      <header>
        <img style="max-width:44mm;max-height:22mm;object-fit:contain" src="${flynnsLogoUrl}" alt="Flynn's Quick Lube" />
        <h1>${payload.business.business_name}</h1>
        <p>${new Date(payload.serviceDate).toLocaleString()}</p>
        <p>Ticket ${payload.receiptNumber}</p>
      </header>
      <p>${customer}</p>
      <table>
        <tbody>${payload.items.map((item) => `<tr><td>${item.name} x ${item.quantity}</td><td>${formatMoney(item.lineTotal)}</td></tr>`).join("")}</tbody>
      </table>
      <section class="totals">
        <div><span>Tax</span><strong>${formatMoney(payload.ticket.tax_total)}</strong></div>
        <div><span>Total</span><strong>${formatMoney(payload.ticket.total)}</strong></div>
        <div><span>Paid</span><strong>${formatMoney(payload.paidTotal)}</strong></div>
        <div><span>Balance</span><strong>${formatMoney(payload.balanceDue)}</strong></div>
      </section>
      <footer>${payload.footer ?? "Thank you."}</footer>
    </section>
  `;
}
