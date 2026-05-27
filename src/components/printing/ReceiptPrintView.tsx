import { formatMoney } from "../../lib/utils/money";
import type { ReceiptPayload } from "../../lib/printing/printTypes";
import flynnsLogoUrl from "../../assets/brand/flynns-quick-lube-logo.png";

export function ReceiptPrintView({ payload }: { payload: ReceiptPayload }) {
  const customer = [payload.ticket.customer_first_name, payload.ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
  const vehicle = [payload.ticket.vehicle_year, payload.ticket.vehicle_make, payload.ticket.vehicle_model].filter(Boolean).join(" ");
  return (
    <article className="receipt-print-view">
      <header>
        <img className="receipt-logo" src={flynnsLogoUrl} alt="Flynn's Quick Lube" />
        <h1>{payload.business.business_name}</h1>
        <p>{new Date(payload.serviceDate).toLocaleString()}</p>
        <p>Ticket {payload.receiptNumber}</p>
      </header>
      <section className="receipt-meta">
        <p>{customer}</p>
        {payload.showVehicle && vehicle ? <p>{vehicle}</p> : null}
      </section>
      <table>
        <tbody>
          {payload.items.map((item) => (
            <tr key={item.id}><td>{item.name} x {item.quantity}</td><td>{formatMoney(item.lineTotal)}</td></tr>
          ))}
        </tbody>
      </table>
      <section className="receipt-totals">
        <div><span>Tax</span><strong>{formatMoney(payload.ticket.tax_total)}</strong></div>
        <div><span>Total</span><strong>{formatMoney(payload.ticket.total)}</strong></div>
        <div><span>Paid</span><strong>{formatMoney(payload.paidTotal)}</strong></div>
        <div><span>Balance</span><strong>{formatMoney(payload.balanceDue)}</strong></div>
      </section>
      <footer>{payload.footer}</footer>
    </article>
  );
}
