import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Gauge,
  History,
  Play,
  Printer,
  RotateCcw,
  Ruler,
  ShieldAlert,
  Tag,
  Users,
  Wrench,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { cancelTicket, completeTicket, getTicketById, reopenTicket, startService, updateTicketStatus } from "../lib/db/repositories/ticketsRepo";
import { getServiceHistoryByVehicle } from "../lib/db/repositories/serviceHistoryRepo";
import { formatMoney } from "../lib/utils/money";
import { useToast } from "../components/ui/useToast";
import type { PaymentMethod } from "../types/payment";
import type { TicketStatus, TicketWithDetails } from "../types/ticket";
import type { ServiceHistory } from "../types/serviceHistory";

interface TicketDetailPageProps {
  ticketId?: string;
  onBack: () => void;
}

const statusLabels: Record<TicketStatus, string> = {
  draft: "Draft",
  checked_in: "Checked In",
  in_service: "In Service",
  waiting_payment: "Waiting Payment",
  completed: "Completed",
  canceled: "Canceled"
};

const actionTiles = [
  ["Print Sticker", Printer],
  ["Vehicle History", History],
  ["Techs", Users],
  ["Fluids", Droplets],
  ["Torque", Gauge],
  ["Oil Light Reset", Wrench],
  ["Tire Sizes", Ruler],
  ["Tire Pressure", Gauge],
  ["Chassis Diagram", ClipboardList],
  ["Grease Fittings", Wrench],
  ["Recalls", ShieldAlert]
] as const;

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function TicketDetailPage({ ticketId, onBack }: TicketDetailPageProps) {
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [finalMileage, setFinalMileage] = useState("");
  const [oilType, setOilType] = useState("");
  const [bay, setBay] = useState("Bay 1");
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const { notify } = useToast();

  const loadTicket = () => {
    if (!ticketId) {
      setError("No ticket selected.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getTicketById(ticketId)
      .then((result) => {
        setTicket(result);
        setPaymentAmount(result?.total ? String(result.total) : "");
        setFinalMileage(result?.vehicle_mileage ? String(result.vehicle_mileage) : "");
        setOilType(result?.vehicle_oil_type ?? "");
        if (result?.bay) setBay(result.bay);
        if (result?.vehicle_id) {
          getServiceHistoryByVehicle(result.vehicle_id).then(setHistory).catch(() => setHistory([]));
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load ticket."))
      .finally(() => setLoading(false));
  };

  useEffect(loadTicket, [ticketId]);

  const runAction = async (action: () => Promise<void>) => {
    setError(null);
    setSaving(true);
    try {
      await action();
      notify({ tone: "success", title: "Ticket updated", message: "The local ticket status was saved." });
      loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update ticket.");
      notify({ tone: "error", title: "Ticket update failed", message: err instanceof Error ? err.message : "Unable to update ticket." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="p-5 text-sm text-slate-600">Loading ticket...</Card>;

  if (!ticket) {
    return (
      <section className="space-y-4">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>Back to Tickets</Button>
        <Card className="p-5 text-sm text-red-700">{error ?? "Ticket not found."}</Card>
      </section>
    );
  }

  const customerName = [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
  const vehicleName = [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={onBack}>Service Tickets</Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Service Ticket</h1>
            <p className="text-sm text-slate-500">{customerName} - {vehicleName} - {ticket.id}</p>
          </div>
        </div>
        <Badge tone={ticket.status === "completed" ? "green" : ticket.status === "canceled" ? "red" : "blue"}>{statusLabels[ticket.status]}</Badge>
      </div>
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-11">
        {actionTiles.map(([label, Icon]) => (
          <button key={label} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-semibold text-slate-500 opacity-70 shadow-sm">
            <Icon className="text-[var(--brand-primary)]" size={20} />
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-white p-6">
            <div className="flex flex-wrap justify-between gap-5">
              <div>
                <div className="text-2xl font-black text-[var(--brand-primary-dark)]">Flynn's Quick Lube</div>
                <div className="mt-1 text-sm text-slate-500">1023 Harrison Avenue, Harrison, Ohio 45030</div>
                <div className="text-sm text-slate-500">Local service order invoice</div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div className="font-semibold text-slate-950">Created {formatDate(ticket.created_at)}</div>
                <div>Completed {formatDate(ticket.completed_at)}</div>
                <div>Payment {ticket.payment_status}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</div>
              <div className="mt-2 font-bold text-slate-950">{customerName}</div>
              <div className="text-sm text-slate-600">{ticket.customer_phone ?? "No phone"} - {ticket.customer_email ?? "No email"}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle</div>
              <div className="mt-2 font-bold text-slate-950">{vehicleName}</div>
              <div className="text-sm text-slate-600">Plate {ticket.vehicle_plate ?? "-"} - Mileage {ticket.vehicle_mileage?.toLocaleString() ?? "-"}</div>
            </div>
          </div>

          <div className="p-6">
            {ticket.packageDetails ? (
              <div className="mb-4 rounded-lg border border-blue-100 bg-[var(--brand-primary-light)] p-4 text-sm text-slate-700">
                <div className="font-bold text-slate-950">{ticket.packageDetails.package_name}</div>
                <div className="mt-1 grid gap-2 md:grid-cols-4">
                  <span>{[ticket.packageDetails.oil_brand, ticket.packageDetails.oil_type].filter(Boolean).join(" / ")}</span>
                  <span>Quarts: {ticket.packageDetails.actual_quarts} ({ticket.packageDetails.included_quarts} included)</span>
                  <span>Filter: {ticket.packageDetails.filter_type.replace("_", " ")}</span>
                  <span>Package total: {formatMoney(ticket.packageDetails.package_total)}</span>
                </div>
              </div>
            ) : null}
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="secondary">Add Inventory Item</Button>
              <Button variant="secondary">Add Custom Item</Button>
              <Button variant="secondary">Add Discount</Button>
              <Button variant="secondary" icon={<Tag size={16} />}>Add Coupon</Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Service / Part</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit</th>
                    <th className="px-4 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border-t border-slate-100 px-4 py-3 font-medium text-slate-950">{item.name}</td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right">{item.quantity}</td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right">{formatMoney(item.unit_price)}</td>
                      <td className="border-t border-slate-100 px-4 py-3 text-right font-semibold">{formatMoney(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">Notes</div>
                <p className="mt-2 text-sm text-slate-600">Concern: {ticket.customer_concern || "None"}</p>
                <p className="mt-1 text-sm text-slate-600">Tech: {ticket.technician_notes || "None"}</p>
                <p className="mt-1 text-sm text-slate-600">Internal: {ticket.internal_notes || "None"}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatMoney(ticket.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Tax</span><span>{formatMoney(ticket.tax_total)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Discount</span><span>{formatMoney(ticket.discount_total)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-black text-slate-950"><span>Total</span><span>{formatMoney(ticket.total)}</span></div>
                <div className="flex justify-between text-lg font-bold text-[var(--brand-primary-dark)]"><span>Amount Due</span><span>{ticket.payment_status === "paid" ? formatMoney(0) : formatMoney(ticket.total)}</span></div>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              Disclaimer placeholder: customer authorizes requested services. Additional terms, warranty language, and receipt disclosures will be configured in a future step.
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-lg font-bold text-slate-950">Workflow Actions</h3>
            <div className="mt-4 grid gap-3">
              {ticket.status === "checked_in" ? (
                <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Assign bay
                    <select className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={bay} onChange={(event) => setBay(event.target.value)}>
                      <option>Bay 1</option>
                      <option>Bay 2</option>
                    </select>
                  </label>
                  <Button disabled={saving} icon={<Play size={16} />} onClick={() => runAction(() => startService(ticket.id, bay))}>Start Service</Button>
                </div>
              ) : null}
              {ticket.status === "in_service" ? <Button disabled={saving} icon={<CheckCircle2 size={16} />} onClick={() => runAction(() => updateTicketStatus(ticket.id, "waiting_payment"))}>Mark Waiting Payment</Button> : null}
              {ticket.status === "waiting_payment" ? (
                <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Payment method
                    <select className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                      <option>Cash</option>
                      <option>Card</option>
                      <option>Check</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Payment amount
                    <Input className="mt-2" type="number" min="0" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Final mileage
                    <Input className="mt-2" type="number" value={finalMileage} onChange={(event) => setFinalMileage(event.target.value)} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Oil type optional
                    <Input className="mt-2" value={oilType} onChange={(event) => setOilType(event.target.value)} />
                  </label>
                  <Button disabled={saving} variant="success" icon={<CheckCircle2 size={16} />} onClick={() => runAction(() => completeTicket(ticket.id, { paymentMethod, paymentAmount: paymentAmount ? Number(paymentAmount) : undefined, finalMileage: Number(finalMileage), oilType: oilType.trim() || null }))}>Complete Ticket</Button>
                </div>
              ) : null}
              {ticket.status !== "completed" && ticket.status !== "canceled" ? <Button disabled={saving} variant="danger" icon={<XCircle size={16} />} onClick={() => runAction(() => cancelTicket(ticket.id))}>Cancel Ticket</Button> : null}
              {ticket.status === "canceled" ? <Button disabled={saving} icon={<RotateCcw size={16} />} onClick={() => runAction(() => reopenTicket(ticket.id))}>Reopen Ticket</Button> : null}
            </div>
          </Card>
        </div>
      </div>
      <Card className="p-5">
        <h3 className="text-lg font-bold text-slate-950">Vehicle Service History</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No service history recorded for this vehicle yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {history.map((entry) => (
              <div key={entry.id} className="grid gap-2 py-3 text-sm md:grid-cols-[160px_120px_1fr]">
                <div className="font-semibold text-slate-950">{new Date(entry.service_date).toLocaleDateString()}</div>
                <div className="text-slate-600">{entry.mileage.toLocaleString()} mi</div>
                <div className="text-slate-600">{entry.oil_type ?? "Oil type not set"} - {entry.notes ?? "Service completed"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
