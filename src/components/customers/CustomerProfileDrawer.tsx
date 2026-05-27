import { useMemo, useState } from "react";
import { Car, ClipboardList, Gift, History, LayoutDashboard, StickyNote, Ticket, X } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { TouchSelect } from "../ui/TouchSelect";
import { formatMoney } from "../../lib/utils/money";
import type { Customer } from "../../types/customer";
import type { Vehicle } from "../../types/vehicle";
import type { TicketWithDetails } from "../../types/ticket";
import type { ServiceHistory } from "../../types/serviceHistory";
import type { VehiclePunchCard, VehiclePunchEvent } from "../../lib/db/repositories/punchCardsRepo";
import type { CustomerCouponRecord } from "../../lib/domain/loyalty/couponRules";
import type { ReferralReward } from "../../lib/domain/loyalty/referralRules";

export type CustomerProfileTab = "overview" | "vehicles" | "history" | "punchCards" | "coupons" | "notes" | "activity";

interface CustomerProfileDrawerProps {
  customer: Customer;
  vehicles: Vehicle[];
  tickets: TicketWithDetails[];
  history: ServiceHistory[];
  coupons: CustomerCouponRecord[];
  referrals: ReferralReward[];
  punchCards: Array<{ vehicle: Vehicle; card: VehiclePunchCard | null; events?: VehiclePunchEvent[] }>;
  defaultTab?: CustomerProfileTab;
  editCustomer: { first_name: string; last_name: string; phone: string; email: string; notes: string };
  manualCoupon: { title: string; amount: string };
  punchNote: string;
  onEditCustomerChange: (value: { first_name: string; last_name: string; phone: string; email: string; notes: string }) => void;
  onManualCouponChange: (value: { title: string; amount: string }) => void;
  onPunchNoteChange: (value: string) => void;
  onClose: () => void;
  onSaveCustomer: () => void;
  onStartTicket: (vehicle?: Vehicle) => void;
  onOpenVehicle?: (vehicleId: string) => void;
  onOpenTicket?: (ticketId: string) => void;
  onAddVehicle: () => void;
  onAssignCoupon: () => void;
  onAddPunch: (vehicle: Vehicle) => void;
}

function customerName(customer: Customer) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Customer";
}

function customerInitials(customer: Customer) {
  const first = customer.first_name?.charAt(0) ?? "";
  const last = customer.last_name?.charAt(0) ?? "";
  return (first + last).toUpperCase() || "?";
}

function vehicleLabel(vehicle: Vehicle) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString();
}

function couponAmount(coupon: CustomerCouponRecord) {
  if (coupon.discount_type === "fixed") return formatMoney(coupon.discount_amount);
  if (coupon.discount_type === "percent") return `${coupon.discount_amount}%`;
  return "Free oil change";
}

function PunchDots({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all ${
            index < count
              ? "bg-amber-500 text-white shadow-sm"
              : "border-2 border-[var(--pos-border)] bg-[var(--pos-panel)] text-[var(--pos-muted)]"
          }`}
        >
          {index < count ? "✓" : index + 1}
        </div>
      ))}
    </div>
  );
}

export function CustomerProfileDrawer({
  customer,
  vehicles,
  tickets,
  history,
  coupons,
  referrals,
  punchCards,
  defaultTab = "overview",
  editCustomer,
  manualCoupon,
  punchNote,
  onEditCustomerChange,
  onManualCouponChange,
  onPunchNoteChange,
  onClose,
  onSaveCustomer,
  onStartTicket,
  onOpenVehicle,
  onOpenTicket,
  onAddVehicle,
  onAssignCoupon,
  onAddPunch
}: CustomerProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<CustomerProfileTab>(defaultTab);
  const [historyVehicleId, setHistoryVehicleId] = useState("all");

  const activeCoupons = coupons.filter((coupon) => coupon.status === "active");
  const openTickets = tickets.filter((ticket) => ticket.status === "checked_in" || ticket.status === "in_service" || ticket.status === "waiting_payment");
  const totalSpent = tickets.filter((ticket) => ticket.status === "completed").reduce((sum, ticket) => sum + ticket.total, 0);
  const totalRewards = punchCards.reduce((sum, row) => sum + (row.card?.free_rewards_available ?? 0), 0);
  const filteredHistory = useMemo(() => historyVehicleId === "all" ? history : history.filter((entry) => entry.vehicle_id === historyVehicleId), [history, historyVehicleId]);

  const tabs: { id: CustomerProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
    { id: "vehicles", label: "Vehicles", icon: <Car size={14} />, count: vehicles.length },
    { id: "history", label: "History", icon: <History size={14} />, count: history.length },
    { id: "punchCards", label: "Punch Cards", icon: <Ticket size={14} />, count: totalRewards || undefined },
    { id: "coupons", label: "Coupons", icon: <Gift size={14} />, count: activeCoupons.length || undefined },
    { id: "notes", label: "Edit Customer", icon: <StickyNote size={14} /> },
    { id: "activity", label: "Activity", icon: <ClipboardList size={14} /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" role="dialog" aria-modal="true" aria-label="Customer profile">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-[var(--pos-border)] bg-[var(--pos-bg)] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--pos-border)] border-t-4 border-t-cyan-500 bg-[var(--pos-panel)]">
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-xl font-black text-cyan-700">
                  {customerInitials(customer)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-[var(--pos-text)]">{customerName(customer)}</h2>
                    {customer.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                    {customer.firebase_uid ? <Badge tone="green">App Linked</Badge> : null}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-[var(--pos-muted)]">
                    {customer.phone ? <span className="font-semibold">{customer.phone}</span> : null}
                    {customer.email ? <span>{customer.email}</span> : null}
                    {history.length ? <span>Last visit {formatDate(history[0]?.service_date)}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button onClick={() => onStartTicket()}>Start Ticket</Button>
                <Button variant="secondary" onClick={() => setActiveTab("notes")}>Edit</Button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-[var(--pos-muted)] hover:bg-[var(--pos-card-hover)] hover:text-[var(--pos-text)]"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Stat chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("vehicles")}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 py-1.5 text-xs font-black text-[var(--pos-text)] hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700 transition"
              >
                <Car size={12} className="text-cyan-600" />
                {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
              </button>
              {openTickets.length > 0 ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                  <Ticket size={12} />
                  {openTickets.length} open ticket{openTickets.length === 1 ? "" : "s"}
                </div>
              ) : null}
              {totalRewards > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("punchCards")}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-100 transition"
                >
                  <Gift size={12} />
                  {totalRewards} free reward{totalRewards === 1 ? "" : "s"} available
                </button>
              ) : null}
              {totalSpent > 0 ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 py-1.5 text-xs font-black text-[var(--pos-text)]">
                  {formatMoney(totalSpent)} lifetime
                </div>
              ) : null}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto px-6 pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${
                  activeTab === tab.id
                    ? "bg-cyan-600 text-white"
                    : "border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-muted)] hover:border-cyan-400 hover:text-cyan-700"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined ? (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-[var(--pos-panel-2)] text-[var(--pos-muted)]"}`}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-6">

          {/* OVERVIEW */}
          {activeTab === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("vehicles")}
                  className="group rounded-2xl border border-[var(--pos-border)] bg-white p-4 text-left hover:border-cyan-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Vehicles</div>
                    <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 group-hover:bg-cyan-100"><Car size={16} /></div>
                  </div>
                  <div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{vehicles.length}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className="group rounded-2xl border border-[var(--pos-border)] bg-white p-4 text-left hover:border-cyan-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Visits</div>
                    <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 group-hover:bg-cyan-100"><History size={16} /></div>
                  </div>
                  <div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{history.length}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("coupons")}
                  className="group rounded-2xl border border-[var(--pos-border)] bg-white p-4 text-left hover:border-cyan-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Coupons</div>
                    <div className="rounded-xl bg-purple-50 p-2 text-purple-600 group-hover:bg-purple-100"><Gift size={16} /></div>
                  </div>
                  <div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{activeCoupons.length}</div>
                </button>
                <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Lifetime</div>
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><Ticket size={16} /></div>
                  </div>
                  <div className="mt-2 text-2xl font-black text-[var(--pos-text)]">{formatMoney(totalSpent)}</div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
                  <h3 className="text-base font-black text-[var(--pos-text)]">Recent Service</h3>
                  {history.length ? (
                    <div className="mt-3 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)]">
                      {history.slice(0, 6).map((entry) => {
                        const vehicle = vehicles.find((v) => v.id === entry.vehicle_id);
                        return (
                          <div key={entry.id} className="grid gap-2 p-3 text-sm md:grid-cols-[110px_1fr_100px_auto] md:items-center">
                            <span className="font-bold text-[var(--pos-text)]">{formatDate(entry.service_date)}</span>
                            <span className="text-[var(--pos-muted)]">{vehicle ? vehicleLabel(vehicle) : "Vehicle"}</span>
                            <span className="text-[var(--pos-muted)]">{entry.mileage.toLocaleString()} mi</span>
                            {onOpenTicket ? (
                              <Button size="sm" variant="secondary" onClick={() => onOpenTicket(entry.ticket_id)}>Open</Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--pos-muted)]">No service history recorded.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
                  <h3 className="text-base font-black text-[var(--pos-text)]">Quick Actions</h3>
                  <div className="mt-4 grid gap-2">
                    <Button onClick={() => onStartTicket()}>Start New Ticket</Button>
                    <Button variant="secondary" onClick={onAddVehicle}>Add Vehicle</Button>
                    <Button variant="secondary" onClick={() => setActiveTab("coupons")}>Assign Coupon</Button>
                    <Button variant="secondary" onClick={() => setActiveTab("notes")}>Edit Customer Info</Button>
                  </div>
                  {referrals.length ? (
                    <div className="mt-4 border-t border-[var(--pos-border)] pt-4">
                      <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Referral Rewards</div>
                      <div className="mt-2 space-y-1">
                        {referrals.slice(0, 3).map((referral) => (
                          <div key={referral.id} className="flex items-center justify-between text-sm">
                            <Badge tone={referral.status === "rewarded" || referral.status === "completed" ? "green" : "yellow"}>{referral.status}</Badge>
                            <span className="font-black">{formatMoney(referral.reward_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* VEHICLES */}
          {activeTab === "vehicles" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-[var(--pos-text)]">{vehicles.length} Vehicle{vehicles.length === 1 ? "" : "s"}</h3>
                <Button onClick={onAddVehicle}>Add Vehicle</Button>
              </div>
              {vehicles.map((vehicle) => {
                const punchRow = punchCards.find((row) => row.vehicle.id === vehicle.id);
                const punch = punchRow?.card;
                return (
                  <div key={vehicle.id} className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50">
                          <Car size={20} className="text-cyan-600" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-black text-[var(--pos-text)]">{vehicleLabel(vehicle)}</h4>
                            {punch?.free_rewards_available ? <Badge tone="yellow">Free oil change available</Badge> : null}
                          </div>
                          <div className="mt-1.5 grid gap-1 text-sm text-[var(--pos-muted)] sm:grid-cols-3">
                            <span>VIN: {vehicle.vin || "—"}</span>
                            <span>Plate: {[vehicle.plate, vehicle.plate_state].filter(Boolean).join(" ") || "—"}</span>
                            <span>Mileage: {vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "—"}</span>
                            <span>Oil: {vehicle.oil_type || "—"}</span>
                            <span>Filter: {vehicle.oil_filter_sku ?? "—"}</span>
                            <span>Capacity: {vehicle.oil_capacity ? `${vehicle.oil_capacity} qt` : "—"}</span>
                          </div>
                          <div className="mt-3 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-xs text-[var(--pos-muted)]">
                            <span className="font-black uppercase tracking-wide text-[var(--pos-text)]">Service Defaults</span>
                            <span className="ml-2">
                              {vehicle.oil_type || vehicle.oil_capacity || vehicle.oil_filter_sku
                                ? `${vehicle.oil_type || "Oil not saved"} · ${vehicle.oil_capacity ? `${vehicle.oil_capacity} qt` : "Capacity not saved"} · ${vehicle.oil_filter_sku ?? "Filter not saved"}`
                                : "No verified defaults saved"}
                            </span>
                            <span className="ml-2">
                              {vehicle.vehicle_info_verified_at ? `Verified ${new Date(vehicle.vehicle_info_verified_at).toLocaleDateString()}` : "Not verified"}
                            </span>
                          </div>
                          {punchRow ? (
                            <div className="mt-3">
                              <PunchDots count={punch?.punch_count ?? 0} />
                              <div className="mt-1.5 text-xs text-[var(--pos-muted)]">
                                {punch?.punch_count ?? 0}/5 punches · {punch?.free_rewards_available ?? 0} reward available
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => onStartTicket(vehicle)}>Start Ticket</Button>
                        {onOpenVehicle ? <Button variant="secondary" onClick={() => onOpenVehicle(vehicle.id)}>Open</Button> : null}
                        <Button variant="secondary" onClick={() => { setHistoryVehicleId(vehicle.id); setActiveTab("history"); }}>History</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!vehicles.length ? (
                <div className="rounded-2xl border border-dashed border-[var(--pos-border)] bg-white p-8 text-center text-sm text-[var(--pos-muted)]">
                  No vehicles linked to this customer.
                </div>
              ) : null}
            </div>
          ) : null}

          {/* SERVICE HISTORY */}
          {activeTab === "history" ? (
            <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-black text-[var(--pos-text)]">Service History</h3>
                <div className="w-64">
                  <TouchSelect
                    value={historyVehicleId}
                    onChange={setHistoryVehicleId}
                    options={[{ value: "all", label: "All Vehicles" }, ...vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicleLabel(vehicle) }))]}
                    searchable
                  />
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-[var(--pos-border)]">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-[var(--pos-panel-2)] text-left text-xs uppercase tracking-wide text-[var(--pos-muted)]">
                    <tr>
                      {["Date", "Vehicle", "Mileage", "Service", "Total", ""].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((entry) => {
                      const vehicle = vehicles.find((row) => row.id === entry.vehicle_id);
                      const ticket = tickets.find((row) => row.id === entry.ticket_id);
                      return (
                        <tr key={entry.id} className="border-t border-[var(--pos-border)] hover:bg-[var(--pos-card-hover)]">
                          <td className="px-4 py-3 font-bold text-[var(--pos-text)]">{formatDate(entry.service_date)}</td>
                          <td className="px-4 py-3 text-[var(--pos-muted)]">{vehicle ? vehicleLabel(vehicle) : "Vehicle"}</td>
                          <td className="px-4 py-3 text-[var(--pos-muted)]">{entry.mileage.toLocaleString()} mi</td>
                          <td className="px-4 py-3 text-[var(--pos-muted)]">{ticket?.service_names ?? entry.oil_type ?? "Service"}</td>
                          <td className="px-4 py-3 font-black text-[var(--pos-text)]">{ticket ? formatMoney(ticket.total) : "—"}</td>
                          <td className="px-4 py-3">
                            {onOpenTicket ? <Button size="sm" variant="secondary" onClick={() => onOpenTicket(entry.ticket_id)}>Open</Button> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredHistory.length ? (
                  <div className="p-6 text-center text-sm text-[var(--pos-muted)]">No service history for this selection.</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* PUNCH CARDS */}
          {activeTab === "punchCards" ? (
            <div className="space-y-4">
              {punchCards.map(({ vehicle, card, events }) => (
                <div key={vehicle.id} className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-black text-[var(--pos-text)]">{vehicleLabel(vehicle)}</h4>
                      <div className="mt-3">
                        <PunchDots count={card?.punch_count ?? 0} />
                      </div>
                      <div className="mt-2 text-sm text-[var(--pos-muted)]">
                        <span className="font-black text-[var(--pos-text)]">{card?.punch_count ?? 0}/5</span> punches ·{" "}
                        <span className={card?.free_rewards_available ? "font-black text-amber-600" : ""}>{card?.free_rewards_available ?? 0} reward{(card?.free_rewards_available ?? 0) === 1 ? "" : "s"} available</span> ·{" "}
                        Last punch {formatDate(events?.[0]?.created_at)}
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => onAddPunch(vehicle)}>Add Punch</Button>
                  </div>
                  <div className="mt-4">
                    <Input label="Punch note (optional)" value={punchNote} onChange={(event) => onPunchNoteChange(event.target.value)} placeholder="Reason or correction note" />
                  </div>
                  {(events ?? []).length > 0 ? (
                    <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)] text-sm">
                      {(events ?? []).slice(0, 5).map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-3">
                          <span className="text-[var(--pos-muted)]">{formatDate(event.created_at)}</span>
                          <span className="font-semibold text-[var(--pos-text)]">{event.event_type}</span>
                          <span className={event.punch_delta > 0 ? "font-black text-emerald-600" : "font-black text-red-600"}>
                            {event.punch_delta > 0 ? "+" : ""}{event.punch_delta}
                          </span>
                          <span className="text-[var(--pos-muted)]">{event.note ?? "No note"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--pos-muted)]">No punch history recorded.</p>
                  )}
                </div>
              ))}
              {!punchCards.length ? (
                <div className="rounded-2xl border border-dashed border-[var(--pos-border)] bg-white p-8 text-center text-sm text-[var(--pos-muted)]">
                  No vehicle punch cards yet. Start a ticket to begin a punch card.
                </div>
              ) : null}
            </div>
          ) : null}

          {/* COUPONS */}
          {activeTab === "coupons" ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
                <h3 className="text-lg font-black text-[var(--pos-text)]">Coupons</h3>
                {coupons.length ? (
                  <div className="mt-3 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)]">
                    {coupons.map((coupon) => (
                      <div key={coupon.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                        <div className="flex-1">
                          <div className="font-black text-[var(--pos-text)]">{coupon.title}</div>
                          <div className="text-xs text-[var(--pos-muted)]">{coupon.expires_at ? `Expires ${formatDate(coupon.expires_at)}` : coupon.source ?? "Manual"}</div>
                        </div>
                        <div className="font-black text-lg text-[var(--pos-text)]">{couponAmount(coupon)}</div>
                        <Badge tone={coupon.status === "active" ? "green" : coupon.status === "redeemed" ? "blue" : "slate"}>
                          {coupon.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--pos-muted)]">No coupons assigned yet.</p>
                )}
              </div>
              <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
                <h3 className="text-lg font-black text-[var(--pos-text)]">Assign Manual Coupon</h3>
                <div className="mt-4 grid gap-3">
                  <Input label="Title / Description" value={manualCoupon.title} onChange={(event) => onManualCouponChange({ ...manualCoupon, title: event.target.value })} />
                  <Input label="Amount ($)" type="number" step="0.01" value={manualCoupon.amount} onChange={(event) => onManualCouponChange({ ...manualCoupon, amount: event.target.value })} />
                  <Button disabled={!manualCoupon.title.trim()} onClick={onAssignCoupon}>Create Coupon</Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* EDIT CUSTOMER */}
          {activeTab === "notes" ? (
            <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
              <h3 className="text-lg font-black text-[var(--pos-text)]">Edit Customer Info</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input label="First name" value={editCustomer.first_name} onChange={(event) => onEditCustomerChange({ ...editCustomer, first_name: event.target.value })} />
                <Input label="Last name" value={editCustomer.last_name} onChange={(event) => onEditCustomerChange({ ...editCustomer, last_name: event.target.value })} />
                <Input label="Phone" value={editCustomer.phone} onChange={(event) => onEditCustomerChange({ ...editCustomer, phone: event.target.value })} />
                <Input label="Email" value={editCustomer.email} onChange={(event) => onEditCustomerChange({ ...editCustomer, email: event.target.value })} />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-semibold text-[var(--pos-text)]">
                  Notes
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-sm text-[var(--pos-text)] outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    value={editCustomer.notes}
                    onChange={(event) => onEditCustomerChange({ ...editCustomer, notes: event.target.value })}
                    placeholder="Internal notes about this customer..."
                  />
                </label>
              </div>
              <Button className="mt-4" onClick={onSaveCustomer}>Save Customer</Button>
            </div>
          ) : null}

          {/* ACTIVITY */}
          {activeTab === "activity" ? (
            <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-5">
              <h3 className="text-lg font-black text-[var(--pos-text)]">Activity / Audit Log</h3>
              <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)] text-sm">
                <div className="flex items-center gap-3 p-3">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                  <span className="text-[var(--pos-muted)]">{formatDate(customer.created_at)}</span>
                  <span className="text-[var(--pos-text)]">Customer created / imported</span>
                </div>
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center gap-3 p-3">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                    <span className="text-[var(--pos-muted)]">{formatDate(vehicle.created_at)}</span>
                    <span className="text-[var(--pos-text)]">Vehicle linked · {vehicleLabel(vehicle)}</span>
                  </div>
                ))}
                {tickets.slice(0, 10).map((ticket) => (
                  <div key={ticket.id} className="flex items-center gap-3 p-3">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                    <span className="text-[var(--pos-muted)]">{formatDate(ticket.created_at)}</span>
                    <span className="text-[var(--pos-text)]">Ticket {ticket.status} · {ticket.service_names ?? "Service"}</span>
                  </div>
                ))}
                {coupons.slice(0, 10).map((coupon) => (
                  <div key={coupon.id} className="flex items-center gap-3 p-3">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-purple-400" />
                    <span className="text-[var(--pos-muted)]">{formatDate(coupon.created_at)}</span>
                    <span className="text-[var(--pos-text)]">Coupon {coupon.status} · {coupon.title}</span>
                  </div>
                ))}
                {!vehicles.length && !tickets.length && !coupons.length ? (
                  <div className="p-4 text-center text-[var(--pos-muted)]">No activity recorded beyond customer creation.</div>
                ) : null}
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
