import { BrandLogo } from "../branding/BrandLogo";
import { Badge } from "../ui/Badge";
import { defaultInvoiceDisclaimer, type BusinessProfile } from "../../lib/config/businessProfile";
import { formatMoney } from "../../lib/utils/money";
import type { Payment } from "../../types/payment";
import type { TicketItem, TicketWithDetails } from "../../types/ticket";
import { useEffect, useState, type ReactNode } from "react";

interface PunchCardLike {
  punch_count: number;
  free_rewards_available: number;
}

interface ModernInvoicePreviewProps {
  ticket: TicketWithDetails;
  businessProfile: BusinessProfile;
  invoiceNumber: string;
  employeeName?: string | null;
  payments: Payment[];
  paidAmount: number;
  balanceDue: number;
  displayPaymentStatus: string;
  punchCard?: PunchCardLike | null;
  editable?: boolean;
  onQuantityChange?: (item: TicketItem, quantity: number) => Promise<void> | void;
  variant?: "screen" | "print";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function quantityLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function quantityWithUnit(item: TicketItem) {
  const lower = item.name.toLowerCase();
  const unit = lower.includes("quart") || lower.includes("oil") && item.quantity !== 1 ? "QT" : "EA";
  return `${quantityLabel(item.quantity)} ${unit}`;
}

function itemUnit(item: TicketItem) {
  const lower = item.name.toLowerCase();
  if (lower.includes("quart") || lower.includes("oil") && item.quantity !== 1) return "QT";
  if (lower.includes("labor")) return "HR";
  return "EA";
}

function canEditQuantity(item: TicketItem) {
  return item.item_type !== "package" && item.item_type !== "discount";
}

function customerName(ticket: TicketWithDetails) {
  return [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
}

function vehicleName(ticket: TicketWithDetails) {
  return [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
}

function itemParts(item: TicketItem) {
  return [item.product_id, item.sku].filter(Boolean).join(" · ");
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function packageOilDescriptor(ticket: TicketWithDetails) {
  const details = ticket.packageDetails;
  if (!details) return null;
  const packageName = normalizeText(details.package_name);
  const brand = details.oil_brand?.trim() || null;
  const savedType = details.oil_type?.trim() || null;
  const normalizedSavedType = normalizeText(savedType);

  let oilType = savedType;
  if (brand && normalizedSavedType.includes(normalizeText(brand))) {
    oilType = null;
  }
  if (normalizedSavedType.includes("mobil 1") && !packageName.includes("mobil")) {
    oilType = null;
  }
  if (normalizedSavedType.includes("duramax") && !packageName.includes("duramax") && !packageName.includes("synthetic blend")) {
    oilType = null;
  }
  if (!oilType) {
    if (packageName.includes("synthetic blend")) oilType = "Synthetic Blend";
    else if (packageName.includes("diesel")) oilType = "Diesel";
    else if (packageName.includes("full syn") || packageName.includes("full synthetic") || packageName.includes("mobil") || packageName.includes("castrol") || packageName.includes("argos")) oilType = "Full Synthetic";
    else if (packageName.includes("conventional")) oilType = "Conventional";
  }
  const cleanBrand = brand && !normalizeText(oilType).includes(normalizeText(brand)) ? brand : null;
  return [cleanBrand, oilType].filter(Boolean).join(" · ");
}

function itemDescription(item: TicketItem, ticket: TicketWithDetails) {
  const parts = itemParts(item);
  if (item.item_type === "package") {
    return [
      packageOilDescriptor(ticket),
      ticket.packageDetails ? `Includes up to ${quantityLabel(Number(ticket.packageDetails.included_quarts))} qt` : null
    ].filter(Boolean).join(" · ") || "Oil change service package";
  }
  if (item.name.toLowerCase().includes("oil filter")) {
    const filterName = ticket.packageDetails?.oil_filter_name?.replace(/^Engine Oil Filter\s*-\s*/i, "");
    return [filterName, parts].filter(Boolean).join(" · ") || "Engine oil filter";
  }
  if (item.name.toLowerCase().includes("extra oil")) return "Oil over included package quantity";
  if (item.item_type === "fee") return "Shop/service fee";
  if (item.item_type === "discount") return "Discount applied";
  return parts || item.item_type || "Service item";
}

function paymentSummary(payments: Payment[]) {
  const paid = payments.filter((payment) => payment.status === "paid");
  if (!paid.length) return "No payment recorded";
  const labels = Array.from(new Set(paid.map((payment) => payment.payment_subtype || payment.method)));
  return labels.join(" / ");
}

function paymentTone(status: string): "green" | "yellow" | "purple" | "slate" {
  if (status === "paid") return "green";
  if (status === "partially_paid" || status === "partial") return "purple";
  if (status === "unpaid") return "yellow";
  return "slate";
}

export function ModernInvoicePreview({
  ticket,
  businessProfile,
  invoiceNumber,
  employeeName,
  payments,
  paidAmount,
  balanceDue,
  displayPaymentStatus,
  punchCard,
  editable = false,
  onQuantityChange,
  variant = "screen"
}: ModernInvoicePreviewProps) {
  const hasRewards = Boolean(punchCard && (punchCard.punch_count > 0 || punchCard.free_rewards_available > 0));
  const punchCount = punchCard?.punch_count ?? 0;
  const freeRewards = punchCard?.free_rewards_available ?? 0;
  const disclaimer = businessProfile.invoice_disclaimer || defaultInvoiceDisclaimer;
  const serviceNotes = [
    ticket.customer_concern ? `Customer concern: ${ticket.customer_concern}` : null,
    ticket.technician_notes ? `Technician notes: ${ticket.technician_notes}` : null,
    ticket.notes ? `Notes: ${ticket.notes}` : null
  ].filter(Boolean);

  return (
    <article className={`invoice-modern invoice-print-root invoice-${variant} mx-auto max-w-[960px] overflow-hidden rounded-[22px] border border-slate-200 bg-white text-slate-950 shadow-[0_14px_38px_rgba(15,23,42,0.10)]`}>
      <header className="invoice-modern-header grid gap-5 border-b border-slate-200 p-6 lg:grid-cols-[230px_minmax(0,1fr)_230px]">
        <div className="flex min-w-0 items-start">
          <BrandLogo size="invoice" className="invoice-brand-logo" />
        </div>
        <div className="invoice-contact min-w-0 border-l border-slate-200 pl-6">
          <h2 className="text-xl font-black text-[#063a7a]">{businessProfile.business_name}</h2>
          <div className="mt-2 space-y-0.5 text-sm leading-5 text-slate-600">
            <p>{businessProfile.address_line_1}</p>
            <p>{businessProfile.city}, {businessProfile.state === "OH" ? "Ohio" : businessProfile.state} {businessProfile.zip}</p>
            <p>{businessProfile.phone || "5133671777"}</p>
            {businessProfile.website ? <p className="break-all text-[#075EC8]">{businessProfile.website}</p> : null}
          </div>
        </div>
        <div className="text-left lg:text-right">
          <div className="text-4xl font-black leading-none tracking-wide text-[#063a7a]">INVOICE</div>
          <div className="invoice-number-pill invoice-blue-fill mt-3 inline-flex max-w-full rounded-lg border border-[#B8C8DA] bg-[#F3F8FF] px-4 py-2.5 text-lg font-black text-[#063a7a]"># {invoiceNumber}</div>
          <div className="mt-3 space-y-1 text-sm leading-5 text-slate-600">
            <p><strong>Date:</strong> {formatDateTime(ticket.completed_at ?? ticket.created_at)}</p>
            <p><strong>Register:</strong> {ticket.bay ?? "-"}</p>
            <p><strong>Cashier:</strong> {employeeName ?? "-"}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 p-6 md:grid-cols-3">
        <InfoCard title="Customer">
          <div className="text-xl font-black">{customerName(ticket)}</div>
          <p>{ticket.customer_phone ?? "-"}</p>
          <p>{ticket.customer_email ?? "-"}</p>
          {hasRewards ? <Badge tone="green">Rewards Member</Badge> : null}
        </InfoCard>
        <InfoCard title="Vehicle">
          <div className="text-xl font-black">{vehicleName(ticket)}</div>
          <p>Engine: {ticket.packageDetails?.oil_type ?? ticket.vehicle_oil_type ?? "-"}</p>
          <p>VIN: {ticket.vehicle_vin ?? "-"}</p>
          <p>Plate: {[ticket.vehicle_plate, ticket.vehicle_plate_state].filter(Boolean).join(" ") || "-"}</p>
          <p>Mileage: {ticket.vehicle_mileage?.toLocaleString() ?? "-"}</p>
        </InfoCard>
        <InfoCard title="Payment">
          <div className="text-xl font-black">{paymentSummary(payments)}</div>
          <p>Total Paid: {formatMoney(paidAmount)}</p>
          <Badge tone={paymentTone(displayPaymentStatus)}>{displayPaymentStatus === "paid" ? "Paid In Full" : displayPaymentStatus.replace("_", " ")}</Badge>
          {balanceDue > 0 ? <p className="font-bold text-[#075EC8]">Amount Due: {formatMoney(balanceDue)}</p> : null}
        </InfoCard>
      </section>

      <section className="px-6 pb-6">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="invoice-line-grid invoice-section-header grid border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-700">
            <div>Item / Service</div>
            <div>Description</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Unit Price</div>
            <div className="text-right">Total</div>
          </div>
          {ticket.items.length ? ticket.items.map((item) => (
            <div key={item.id} className="invoice-line-row invoice-line-grid grid items-center border-t border-slate-200 px-4 py-3 text-sm">
              <div className="font-black">{item.name}</div>
              <div className="text-slate-600">{itemDescription(item, ticket)}</div>
              <EditableQuantityCell item={item} editable={editable && canEditQuantity(item)} onQuantityChange={onQuantityChange} />
              <div className="text-right">{formatMoney(item.unit_price)}</div>
              <div className={`text-right font-black ${item.line_total < 0 || item.item_type === "discount" ? "text-green-700" : ""}`}>{formatMoney(item.line_total)}</div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-slate-500">No line items recorded.</div>
          )}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_330px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-black uppercase tracking-wide text-[#063a7a]">Service Notes</div>
            <div className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
              {serviceNotes.length ? serviceNotes.map((note) => <p key={note}>{note}</p>) : <p>No service notes recorded.</p>}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            <div className="space-y-1.5 p-4">
              <TotalRow label="Subtotal" value={formatMoney(ticket.subtotal)} />
              <TotalRow label="Discount" value={`-${formatMoney(ticket.discount_total)}`} highlight={ticket.discount_total > 0 ? "green" : undefined} />
              {ticket.discount_total > 0 ? <TotalRow label="Subtotal After Discount" value={formatMoney(Math.max(ticket.subtotal - ticket.discount_total, 0))} /> : null}
              <TotalRow label="Tax" value={formatMoney(ticket.tax_total)} />
              {ticket.fee_total > 0 ? <TotalRow label="Fees" value={formatMoney(ticket.fee_total)} /> : null}
              <TotalRow label="Paid" value={formatMoney(paidAmount)} />
              <TotalRow label="Amount Due" value={formatMoney(balanceDue)} />
            </div>
            <div className="invoice-total-row invoice-blue-fill flex items-center justify-between border-t-2 border-[#075EC8] bg-[#F3F8FF] px-4 py-3 text-xl font-black text-[#063a7a]">
              <span>Total</span>
              <span>{formatMoney(ticket.total)}</span>
            </div>
          </div>
        </div>

        <section className="invoice-rewards-panel mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
          {hasRewards ? (
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-[#063a7a]">Punch Card Rewards</div>
                <h3 className="mt-1 text-xl font-black">Rewards Member</h3>
                <p className="mt-2 text-sm text-slate-600">{punchCount} of 5 Oil Changes. Next Reward: Free Oil Change at 5 punches.</p>
                {freeRewards > 0 ? <p className="mt-2 font-black text-green-700">Free Oil Change Reward Available</p> : null}
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map((index) => <span key={index} className={`invoice-punch-dot h-7 w-7 rounded-full border-2 ${index < punchCount ? "border-[#075EC8] bg-[#E6F1FF]" : "border-slate-300 bg-white"}`} />)}
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-[#063a7a]">Quick And Convenient</div>
                <h3 className="mt-1 text-xl font-black">Download the Flynn’s Quick Lube app.</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Track your visits, join our punch-card rewards program, check in faster, and stay up to date with coupons and service history.</p>
              </div>
              <div className="invoice-app-badges no-print grid gap-2">
                <span className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white">Download on the App Store</span>
                <span className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white">Get it on Google Play</span>
              </div>
            </div>
          )}
        </section>

        <section className="mt-5 grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-[0.8fr_1fr_1fr_1fr]">
          <div className="text-sm font-black uppercase tracking-wide text-[#063a7a]">Our Promise</div>
          <Promise title="Quality Service" text="We use premium products and do the job right." />
          <Promise title="Quick & Convenient" text="We respect your time and get you back on the road." />
          <Promise title="100% Satisfaction" text="If you’re not satisfied, we’ll make it right." />
          <div className="md:col-span-4 text-sm font-bold text-slate-600">Stay connected: @flynnsquicklube</div>
        </section>

        <footer className="mt-4 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] leading-5 text-slate-600">
          {disclaimer}
        </footer>
      </section>
    </article>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="invoice-card overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="invoice-section-header border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#063a7a]">{title}</div>
      <div className="space-y-1.5 p-4 text-sm leading-5 text-slate-600">{children}</div>
    </div>
  );
}

function EditableQuantityCell({ item, editable, onQuantityChange }: { item: TicketItem; editable: boolean; onQuantityChange?: (item: TicketItem, quantity: number) => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.quantity));
  const [error, setError] = useState<string | null>(null);
  const unit = itemUnit(item);

  useEffect(() => setValue(String(item.quantity)), [item.quantity]);

  const save = async () => {
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0) {
      setError("Invalid quantity");
      return;
    }
    if (unit === "EA" && !Number.isInteger(next)) {
      setError("Use a whole number");
      return;
    }
    setError(null);
    await onQuantityChange?.(item, next);
    setEditing(false);
  };

  if (!editable || !onQuantityChange) return <div className="text-right">{quantityWithUnit(item)}</div>;

  if (editing) {
    return (
      <div className="no-print flex flex-col items-end gap-1">
        <div className="flex items-center justify-end gap-1">
          <input
            className="h-10 w-20 rounded-lg border border-[#B8C8DA] px-2 text-right font-black outline-none focus:border-[#075EC8] focus:ring-2 focus:ring-[#E6F1FF]"
            type="number"
            min="0.01"
            step={unit === "EA" ? "1" : "0.1"}
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") {
                setEditing(false);
                setValue(String(item.quantity));
                setError(null);
              }
            }}
          />
          <span className="text-xs font-black text-slate-500">{unit}</span>
        </div>
        <div className="flex gap-1">
          <button className="rounded-md bg-[#075EC8] px-2 py-1 text-xs font-black text-white" type="button" onClick={() => void save()}>Save</button>
          <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-black text-slate-600" type="button" onClick={() => { setEditing(false); setValue(String(item.quantity)); setError(null); }}>Cancel</button>
        </div>
        {error ? <span className="text-xs font-bold text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="no-print ml-auto block rounded-lg border border-transparent px-2 py-1 text-right font-black text-[#075EC8] hover:border-[#B8C8DA] hover:bg-[#E6F1FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6F1FF]"
      onClick={() => setEditing(true)}
      title="Edit quantity"
    >
      {quantityWithUnit(item)}
    </button>
  );
}

function TotalRow({ label, value, highlight }: { label: string; value: string; highlight?: "green" }) {
  return <div className={`flex justify-between gap-4 ${highlight === "green" ? "font-black text-green-700" : "text-slate-700"}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Promise({ title, text }: { title: string; text: string }) {
  return <div><div className="font-black uppercase text-[#063a7a]">{title}</div><p className="mt-1 text-sm text-slate-600">{text}</p></div>;
}
