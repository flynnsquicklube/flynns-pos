import { defaultInvoiceDisclaimer } from "../config/businessProfile";
import { formatMoney } from "../utils/money";
import flynnsLogoUrl from "../../assets/brand/flynns-quick-lube-logo.png";
import type { InvoicePayload, PrintLineItem } from "./printTypes";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function quantityLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function quantityWithUnit(item: PrintLineItem) {
  const lower = item.name.toLowerCase();
  const unit = lower.includes("quart") || (lower.includes("oil") && item.quantity !== 1) ? "QT" : "EA";
  return `${quantityLabel(item.quantity)} ${unit}`;
}

function itemDescription(item: PrintLineItem, payload: InvoicePayload) {
  const parts = [item.productId, item.sku].filter(Boolean).join(" · ");
  if (item.itemType === "package") {
    return [
      payload.ticket.packageDetails?.oil_brand,
      payload.ticket.packageDetails?.oil_type,
      payload.ticket.packageDetails ? `Includes up to ${quantityLabel(Number(payload.ticket.packageDetails.included_quarts))} qt` : null
    ].filter(Boolean).join(" · ") || "Oil change service package";
  }
  if (item.name.toLowerCase().includes("oil filter")) {
    return [payload.ticket.packageDetails?.oil_filter_name?.replace(/^Engine Oil Filter\s*-\s*/i, ""), parts].filter(Boolean).join(" · ") || "Engine oil filter";
  }
  if (item.name.toLowerCase().includes("extra oil")) return "Oil over included package quantity";
  if (item.itemType === "fee") return "Shop/service fee";
  if (item.itemType === "discount") return "Discount applied";
  return parts || item.itemType || "Service item";
}

function paymentStatus(payload: InvoicePayload) {
  if (payload.balanceDue <= 0) return "PAID IN FULL";
  if (payload.paidTotal > 0) return "PARTIALLY PAID";
  return "UNPAID";
}

function paymentSummary(payload: InvoicePayload) {
  if (!payload.payments.length) return "No payment recorded";
  return Array.from(new Set(payload.payments.map((payment) => payment.method))).join(" / ");
}

export function renderInvoiceHtml(payload: InvoicePayload): string {
  const ticket = payload.ticket;
  const customer = [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
  const vehicle = [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
  const disclaimer = payload.business.invoice_disclaimer || defaultInvoiceDisclaimer;
  const notes = [
    ticket.customer_concern ? `Customer concern: ${ticket.customer_concern}` : null,
    ticket.technician_notes ? `Technician notes: ${ticket.technician_notes}` : null,
    ticket.notes ? `Notes: ${ticket.notes}` : null
  ].filter(Boolean);

  return `
    <style>
      @page { size: letter; margin: .35in; }
      body { margin: 0; background: #eef2f7; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
      .invoice-print-root { width: min(8.5in, 100%); margin: 0 auto; background: #fff; border-radius: 18px; overflow: hidden; box-sizing: border-box; }
      .invoice-header { display: grid; grid-template-columns: 2.35in 1fr 1.95in; gap: .22in; padding: .3in; border-bottom: 1px solid #d8e1ec; break-inside: avoid; }
      .logo img { width: 2.2in; height: 1.05in; object-fit: contain; object-position: left top; }
      .contact { border-left: 1px solid #d8e1ec; padding-left: .2in; }
      .contact h1 { margin: 0 0 .08in; color: #063a7a; font-size: 18pt; }
      .contact p, .meta p { margin: .025in 0; font-size: 8.5pt; color: #475569; }
      .meta { text-align: right; }
      .meta-title { color: #063a7a; font-size: 28pt; line-height: 1; font-weight: 900; letter-spacing: .04em; }
      .invoice-number { display: inline-block; margin-top: .1in; border-radius: .06in; background: #075ec8; color: #fff; padding: .08in .14in; font-size: 13pt; font-weight: 900; }
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: .14in; padding: .23in .3in; }
      .info-card { border: 1px solid #d8e1ec; border-radius: .1in; overflow: hidden; break-inside: avoid; }
      .info-card h2 { margin: 0; background: #075ec8; color: #fff; padding: .08in .11in; font-size: 8.5pt; letter-spacing: .06em; text-transform: uppercase; }
      .info-card div { padding: .12in; font-size: 8.8pt; color: #475569; line-height: 1.5; }
      .info-card strong { display: block; color: #0f172a; font-size: 12pt; margin-bottom: .04in; }
      .badge { display: inline-block; margin-top: .04in; border-radius: 999px; background: #dcfce7; color: #166534; padding: .03in .08in; font-weight: 900; text-transform: uppercase; }
      .content { padding: 0 .3in .3in; }
      .table { border: 1px solid #d8e1ec; border-radius: .1in; overflow: hidden; }
      .row { display: grid; grid-template-columns: 1.2fr 1.45fr .6fr .75fr .75fr; align-items: center; }
      .head { background: #075ec8; color: #fff; font-size: 8.5pt; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; }
      .cell { padding: .09in .11in; border-top: 1px solid #e2e8f0; font-size: 8.7pt; }
      .head .cell { border-top: 0; }
      .right { text-align: right; }
      .item { color: #0f172a; font-weight: 900; }
      .desc { color: #64748b; }
      .negative { color: #15803d; }
      .lower { display: grid; grid-template-columns: 1fr 2.35in; gap: .18in; margin-top: .18in; }
      .notes, .totals, .promo, .promise, .disclaimer { border: 1px solid #d8e1ec; border-radius: .1in; break-inside: avoid; }
      .notes { padding: .13in; min-height: .72in; font-size: 8.8pt; color: #475569; }
      .label { color: #063a7a; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; font-size: 8.5pt; }
      .totals { overflow: hidden; font-size: 9pt; }
      .totals-body { padding: .13in; }
      .total-line { display: flex; justify-content: space-between; gap: .12in; margin: .05in 0; }
      .total-grand { display: flex; justify-content: space-between; background: #075ec8; color: #fff; padding: .1in .13in; font-size: 15pt; font-weight: 900; }
      .promo { margin-top: .18in; padding: .16in; background: #f8fbff; display: grid; grid-template-columns: 1fr 1.65in; gap: .16in; align-items: center; }
      .promo h3 { margin: .03in 0; font-size: 15pt; color: #0f172a; }
      .promo p { margin: 0; color: #475569; font-size: 9pt; line-height: 1.45; }
      .store { display: block; border-radius: .06in; background: #020617; color: #fff; padding: .08in .12in; margin: .05in 0; text-align: center; font-weight: 900; font-size: 8pt; }
      .promise { margin-top: .16in; padding: .13in; display: grid; grid-template-columns: .8fr 1fr 1fr 1fr; gap: .13in; font-size: 8pt; color: #475569; }
      .promise strong { display: block; color: #063a7a; text-transform: uppercase; }
      .disclaimer { margin-top: .16in; padding: .12in; white-space: pre-line; color: #475569; font-size: 7.3pt; line-height: 1.35; }
      @media print {
        body { background: #fff !important; }
        .no-print { display: none !important; }
        .invoice-print-root { width: 8.5in; box-shadow: none !important; border-radius: 0; }
        .invoice-header, .row, .info-card, .notes, .totals, .promo, .promise, .disclaimer { break-inside: avoid; }
      }
    </style>
    <article class="invoice-print-root">
      <header class="invoice-header">
        <div class="logo"><img src="${flynnsLogoUrl}" alt="Flynn's Quick Lube" /></div>
        <div class="contact">
          <h1>${escapeHtml(payload.business.business_name)}</h1>
          <p>${escapeHtml(payload.business.address_line_1)}</p>
          <p>${escapeHtml(payload.business.city)}, ${escapeHtml(payload.business.state === "OH" ? "Ohio" : payload.business.state)} ${escapeHtml(payload.business.zip)}</p>
          <p>${escapeHtml(payload.business.phone || "5133671777")}</p>
          ${payload.business.website ? `<p>${escapeHtml(payload.business.website)}</p>` : ""}
        </div>
        <div class="meta">
          <div class="meta-title">INVOICE</div>
          <div class="invoice-number"># ${escapeHtml(payload.invoiceNumber)}</div>
          <p><strong>Date:</strong> ${escapeHtml(formatDate(ticket.completed_at ?? ticket.created_at))}</p>
          <p><strong>Register:</strong> ${escapeHtml(ticket.bay ?? "-")}</p>
          <p><strong>Cashier:</strong> Brandon Flynn</p>
        </div>
      </header>
      <section class="cards">
        <div class="info-card"><h2>Customer</h2><div><strong>${escapeHtml(customer)}</strong><p>${escapeHtml(ticket.customer_phone ?? "-")}</p><p>${escapeHtml(ticket.customer_email ?? "-")}</p></div></div>
        <div class="info-card"><h2>Vehicle</h2><div><strong>${escapeHtml(vehicle)}</strong><p>Engine: ${escapeHtml(ticket.packageDetails?.oil_type ?? ticket.vehicle_oil_type ?? "-")}</p><p>VIN: ${escapeHtml(ticket.vehicle_vin ?? "-")}</p><p>Plate: ${escapeHtml([ticket.vehicle_plate, ticket.vehicle_plate_state].filter(Boolean).join(" ") || "-")}</p><p>Mileage: ${escapeHtml(ticket.vehicle_mileage?.toLocaleString() ?? "-")}</p></div></div>
        <div class="info-card"><h2>Payment</h2><div><strong>${escapeHtml(paymentSummary(payload))}</strong><p>Total Paid: ${formatMoney(payload.paidTotal)}</p><span class="badge">${escapeHtml(paymentStatus(payload))}</span>${payload.balanceDue > 0 ? `<p><strong>Amount Due: ${formatMoney(payload.balanceDue)}</strong></p>` : ""}</div></div>
      </section>
      <main class="content">
        <section class="table">
          <div class="row head"><div class="cell">Item / Service</div><div class="cell">Description</div><div class="cell right">Qty</div><div class="cell right">Unit Price</div><div class="cell right">Total</div></div>
          ${payload.items.length ? payload.items.map((item) => `<div class="row"><div class="cell item">${escapeHtml(item.name)}</div><div class="cell desc">${escapeHtml(itemDescription(item, payload))}</div><div class="cell right">${escapeHtml(quantityWithUnit(item))}</div><div class="cell right">${formatMoney(item.unitPrice)}</div><div class="cell right item ${item.lineTotal < 0 || item.itemType === "discount" ? "negative" : ""}">${formatMoney(item.lineTotal)}</div></div>`).join("") : `<div class="cell">No line items recorded.</div>`}
        </section>
        <section class="lower">
          <div class="notes"><div class="label">Service Notes</div>${notes.length ? notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("") : "<p>No service notes recorded.</p>"}</div>
          <div class="totals"><div class="totals-body"><div class="total-line"><span>Subtotal</span><strong>${formatMoney(ticket.subtotal)}</strong></div><div class="total-line negative"><span>Discount</span><strong>-${formatMoney(ticket.discount_total)}</strong></div>${ticket.discount_total > 0 ? `<div class="total-line"><span>Subtotal After Discount</span><strong>${formatMoney(Math.max(ticket.subtotal - ticket.discount_total, 0))}</strong></div>` : ""}<div class="total-line"><span>Tax</span><strong>${formatMoney(ticket.tax_total)}</strong></div>${ticket.fee_total > 0 ? `<div class="total-line"><span>Fees</span><strong>${formatMoney(ticket.fee_total)}</strong></div>` : ""}<div class="total-line"><span>Paid</span><strong>${formatMoney(payload.paidTotal)}</strong></div><div class="total-line"><span>Amount Due</span><strong>${formatMoney(payload.balanceDue)}</strong></div></div><div class="total-grand"><span>Total</span><span>${formatMoney(ticket.total)}</span></div></div>
        </section>
        <section class="promo"><div><div class="label">Quick And Convenient</div><h3>Download the Flynn’s Quick Lube app.</h3><p>Track your visits, join our punch-card rewards program, check in faster, and stay up to date with coupons and service history.</p></div><div><span class="store">Download on the App Store</span><span class="store">Get it on Google Play</span></div></section>
        <section class="promise"><div class="label">Our Promise</div><div><strong>Quality Service</strong>We use premium products and do the job right.</div><div><strong>Quick &amp; Convenient</strong>We respect your time and get you back on the road.</div><div><strong>100% Satisfaction</strong>If you’re not satisfied, we’ll make it right.</div><div style="grid-column:1 / -1;font-weight:700;">@flynnsquicklube</div></section>
        <footer class="disclaimer">${escapeHtml(disclaimer)}</footer>
      </main>
    </article>
  `;
}
