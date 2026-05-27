import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  DollarSign,
  FileText,
  History,
  PackagePlus,
  Pencil,
  Play,
  Printer,
  RotateCcw,
  StickyNote,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { AddPaymentModal } from "../components/payments/AddPaymentModal";
import { ModernInvoicePreview } from "../components/invoices/ModernInvoicePreview";
import { InvoicePrintView } from "../components/printing/InvoicePrintView";
import { PrintPreviewModal } from "../components/printing/PrintPreviewModal";
import { ReceiptPrintView } from "../components/printing/ReceiptPrintView";
import { WindowStickerPrintView } from "../components/printing/WindowStickerPrintView";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { TouchSelect } from "../components/ui/TouchSelect";
import { useToast } from "../components/ui/useToast";
import { searchInventoryAdvanced, type InventorySearchFilters } from "../lib/db/repositories/inventoryRepo";
import { createPaymentAndRefreshTicket, getPaymentsByTicket, getTicketPaymentSummary, type TicketPaymentSummary } from "../lib/db/repositories/paymentsRepo";
import { listPrintJobsByTicket } from "../lib/db/repositories/printJobsRepo";
import { getServiceHistoryByVehicle } from "../lib/db/repositories/serviceHistoryRepo";
import { addTicketItem, cancelTicket, finalizeTicket, getTicketById, listActiveTickets, markWaitingPayment, removeTicketItem, reopenTicket, sendTicketToBay, updateTicketItem, updateTicketItemQuantity, updateTicketNotes } from "../lib/db/repositories/ticketsRepo";
import { getSetting } from "../lib/db/repositories/settingsRepo";
import { applyCouponToTicket, getTicketCouponApplications, listActiveCouponsByCustomer, removeCouponFromTicket, type TicketCouponApplication } from "../lib/db/repositories/couponsRepo";
import { createFreeOilChangeCoupon, getPunchCardByVehicle, type VehiclePunchCard } from "../lib/db/repositories/punchCardsRepo";
import { defaultBusinessProfile, getBusinessProfile, type BusinessProfile } from "../lib/config/businessProfile";
import { getDisplayInvoiceNumber } from "../lib/domain/invoices/invoiceNumber";
import { getTicketBackDestination, type TicketBackDestination, type TicketRouteState } from "../lib/domain/tickets/ticketNavigation";
import { getRewardSummary } from "../lib/domain/loyalty/rewardDisplay";
import { validateCanFinalizeTicket } from "../lib/domain/startTicket/startTicketValidation";
import type { CustomerCouponRecord } from "../lib/domain/loyalty/couponRules";
import { setStartTicketContext } from "../lib/domain/startTicket/startTicketContext";
import { getCurrentEmployeeSnapshot } from "../lib/security/currentUser";
import { listAuditLogsForEntity, type AuditLogEntry } from "../lib/db/repositories/auditLogRepo";
import { createInvoicePrintJob, createReceiptPrintJob, createWindowStickerPrintJob, markPrintJobPreviewed, markPrintJobPrinted, printWindowHtml } from "../lib/printing/printJobService";
import type { InvoicePayload, PrintJob, ReceiptPayload, WindowStickerPayload } from "../lib/printing/printTypes";
import { formatMoney } from "../lib/utils/money";
import type { Payment } from "../types/payment";
import type { InventoryItem } from "../types/inventory";
import type { ServiceHistory } from "../types/serviceHistory";
import type { TicketItem, TicketLineInput, TicketStatus, TicketWithDetails } from "../types/ticket";

interface TicketDetailPageProps {
  ticketId?: string;
  routeState?: TicketRouteState;
  onBack: (destination: TicketBackDestination) => void;
  onStartTicket?: () => void;
  onOpenCustomer?: (customerId: string) => void;
  onOpenVehicle?: (vehicleId: string) => void;
}

type DetailTab = "invoice" | "payments" | "history" | "notes" | "internal";
type AddItemMode = "inventory" | "labor" | "discount" | "coupon" | "fee" | "custom" | null;
type BayName = "Bay 1" | "Bay 2";

const statusLabels: Record<TicketStatus, string> = {
  draft: "Draft",
  checked_in: "Checked In",
  in_service: "In Service",
  waiting_payment: "Waiting Payment",
  completed: "Completed",
  canceled: "Canceled"
};

const tabs: { id: DetailTab; label: string; icon: JSX.Element }[] = [
  { id: "invoice", label: "Invoice", icon: <FileText size={16} /> },
  { id: "payments", label: "Payments", icon: <CreditCard size={16} /> },
  { id: "history", label: "Service History", icon: <History size={16} /> },
  { id: "notes", label: "Notes", icon: <StickyNote size={16} /> },
  { id: "internal", label: "Internal / Audit", icon: <Pencil size={16} /> }
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusTone(status: TicketStatus): "blue" | "green" | "yellow" | "red" | "slate" | "purple" {
  if (status === "completed") return "green";
  if (status === "canceled") return "red";
  if (status === "waiting_payment") return "purple";
  if (status === "in_service") return "yellow";
  return "blue";
}

function paymentTone(status: string): "blue" | "green" | "yellow" | "red" | "slate" | "purple" {
  if (status === "paid") return "green";
  if (status === "unpaid") return "yellow";
  if (status === "partially_paid" || status === "partial") return "purple";
  if (status === "voided" || status === "refunded") return "red";
  return "slate";
}

export function TicketDetailPage({ ticketId, routeState, onBack, onStartTicket, onOpenCustomer, onOpenVehicle }: TicketDetailPageProps) {
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("invoice");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [bayModalOpen, setBayModalOpen] = useState(false);
  const [activeBayTickets, setActiveBayTickets] = useState<TicketWithDetails[]>([]);
  const [selectedBay, setSelectedBay] = useState<BayName>("Bay 1");
  const [paymentSummary, setPaymentSummary] = useState<TicketPaymentSummary | null>(null);
  const [finalMileage, setFinalMileage] = useState("");
  const [oilType, setOilType] = useState("");
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<CustomerCouponRecord[]>([]);
  const [couponApplications, setCouponApplications] = useState<TicketCouponApplication[]>([]);
  const [punchCard, setPunchCard] = useState<VehiclePunchCard | null>(null);
  const [notesForm, setNotesForm] = useState({ customer_concern: "", technician_notes: "", internal_notes: "" });
  const [customItem, setCustomItem] = useState({ name: "", quantity: "1", unit_price: "0", taxable: true });
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditLogEntry[]>([]);
  const [activePrintJob, setActivePrintJob] = useState<PrintJob | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(defaultBusinessProfile);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemMode, setAddItemMode] = useState<AddItemMode>(null);
  const [editingItem, setEditingItem] = useState<TicketItem | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<keyof InventorySearchFilters | null>("oilFilters");
  const [inventoryResults, setInventoryResults] = useState<InventoryItem[]>([]);
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [lineForm, setLineForm] = useState({ name: "", quantity: "1", unit_price: "0", taxable: true, discountType: "dollar" as "dollar" | "percent" });
  const [taxRate, setTaxRate] = useState(0);
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
        setFinalMileage(result?.vehicle_mileage ? String(result.vehicle_mileage) : "");
        setOilType(result?.vehicle_oil_type ?? "");
        setNotesForm({
          customer_concern: result?.customer_concern ?? "",
          technician_notes: result?.technician_notes ?? "",
          internal_notes: result?.internal_notes ?? ""
        });
        if (result?.id) {
          getPaymentsByTicket(result.id).then(setPayments).catch(() => setPayments([]));
          getTicketPaymentSummary(result.id).then(setPaymentSummary).catch(() => setPaymentSummary(null));
          getTicketCouponApplications(result.id).then(setCouponApplications).catch(() => setCouponApplications([]));
          listPrintJobsByTicket(result.id).then(setPrintJobs).catch(() => setPrintJobs([]));
          listAuditLogsForEntity("ticket", result.id).then(setAuditEvents).catch(() => setAuditEvents([]));
        }
        if (result?.customer_id) {
          listActiveCouponsByCustomer(result.customer_id).then(setActiveCoupons).catch(() => setActiveCoupons([]));
        }
        if (result?.vehicle_id) {
          getServiceHistoryByVehicle(result.vehicle_id).then(setHistory).catch(() => setHistory([]));
          getPunchCardByVehicle(result.vehicle_id).then(setPunchCard).catch(() => setPunchCard(null));
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load ticket."))
      .finally(() => setLoading(false));
  };

  useEffect(loadTicket, [ticketId]);
  useEffect(() => {
    getBusinessProfile().then(setBusinessProfile).catch(() => setBusinessProfile(defaultBusinessProfile));
    getSetting("tax_rate").then((setting) => setTaxRate(setting ? Number(setting.value) || 0 : 0)).catch(() => setTaxRate(0));
  }, []);
  useEffect(() => {
    if (addItemMode !== "inventory") return;
    const handle = window.setTimeout(() => {
      const filters: InventorySearchFilters = { active: true };
      if (inventoryFilter) filters[inventoryFilter] = true;
      searchInventoryAdvanced(inventorySearch, filters, 30, 0).then(setInventoryResults).catch(() => setInventoryResults([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [addItemMode, inventoryFilter, inventorySearch]);

  const runAction = async (action: () => Promise<void>, success = "The ticket was saved.") => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await action();
      notify({ tone: "success", title: "Ticket updated", message: success });
      loadTicket();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update ticket.";
      setError(message);
      notify({ tone: "error", title: "Ticket update failed", message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="p-5 text-sm text-[var(--pos-muted)]">Loading ticket...</Card>;

  if (!ticket) {
    const fallbackDestination = getTicketBackDestination(null, routeState);
    return (
      <section className="space-y-4">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => onBack(fallbackDestination)}>Back to {fallbackDestination.label}</Button>
        <Card className="p-5 text-sm text-red-700">{error ?? "Ticket not found."}</Card>
      </section>
    );
  }

  const invoiceNumber = getDisplayInvoiceNumber(ticket);
  const customerName = [ticket.customer_first_name, ticket.customer_last_name].filter(Boolean).join(" ") || "Walk-in";
  const employeeName = getCurrentEmployeeSnapshot().display_name;
  const locked = ticket.status === "completed";
  const paidAmount = paymentSummary?.paid ?? payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amount, 0);
  const balanceDue = paymentSummary?.balanceDue ?? Math.max(ticket.total - paidAmount, 0);
  const displayPaymentStatus = ticket.payment_status === "partial" ? "partially_paid" : ticket.payment_status;
  const backDestination = getTicketBackDestination(ticket, routeState);
  const activeApplications = couponApplications.filter((application) => application.status === "applied" || application.status === "redeemed");
  const canEditTicketItems = ticket.status !== "completed" && ticket.status !== "canceled" && displayPaymentStatus !== "paid";
  const canUseBayAction = ticket.status !== "completed" && ticket.status !== "canceled";
  const bayActionLabel = ticket.status === "waiting_payment" || (displayPaymentStatus === "paid" && ticket.status !== "completed" && ticket.status !== "canceled")
    ? "Send Back to Bay"
    : ticket.bay
      ? "Move Bay"
      : "Send to Bay";

  const resetAddItemState = () => {
    setAddItemMode(null);
    setEditingItem(null);
    setLineForm({ name: "", quantity: "1", unit_price: "0", taxable: true, discountType: "dollar" });
    setInventoryQuantity("1");
  };

  const openLineModal = (mode: Exclude<AddItemMode, "inventory" | "coupon" | null>, item?: TicketItem) => {
    setAddItemOpen(false);
    setEditingItem(item ?? null);
    setAddItemMode(mode);
    if (item) {
      setLineForm({
        name: item.name,
        quantity: String(item.quantity),
        unit_price: String(mode === "discount" ? Math.abs(item.unit_price) : item.unit_price),
        taxable: item.taxable === 1,
        discountType: "dollar"
      });
      return;
    }
    setLineForm({
      name: mode === "labor" ? "Labor" : mode === "fee" ? "Environmental Fee" : mode === "discount" ? "Manager Discount" : "",
      quantity: "1",
      unit_price: mode === "labor" ? "100" : "0",
      taxable: mode !== "discount",
      discountType: "dollar"
    });
  };

  const closeLineModal = () => resetAddItemState();

  const saveNotes = () => runAction(async () => {
    await updateTicketNotes(ticket.id, {
      customer_concern: notesForm.customer_concern || null,
      technician_notes: notesForm.technician_notes || null,
      internal_notes: notesForm.internal_notes || null
    });
  }, "Notes saved.");

  const addCustomItem = () => runAction(async () => {
    if (!customItem.name.trim()) throw new Error("Item name is required.");
    await addTicketItem(ticket.id, {
      service_id: null,
      item_type: "custom",
      package_id: null,
      inventory_item_id: null,
      name: customItem.name.trim(),
      quantity: Math.max(Number(customItem.quantity) || 1, 0.1),
      unit_price: Number(customItem.unit_price) || 0,
      taxable: customItem.taxable ? 1 : 0
    }, taxRate);
    setCustomItem({ name: "", quantity: "1", unit_price: "0", taxable: true });
  }, "Custom item added.");

  const saveLineItemModal = () => runAction(async () => {
    if (!addItemMode || addItemMode === "inventory" || addItemMode === "coupon") return;
    const quantity = Math.max(Number(lineForm.quantity) || 1, 0.01);
    const enteredAmount = Math.max(Number(lineForm.unit_price) || 0, 0);
    const amount = addItemMode === "discount" && lineForm.discountType === "percent"
      ? Math.round((Math.max(ticket.subtotal - ticket.discount_total, 0) * Math.min(enteredAmount, 100) / 100) * 100) / 100
      : enteredAmount;
    if (!lineForm.name.trim()) throw new Error("Item name is required.");
    if (amount <= 0 && addItemMode !== "discount") throw new Error("Amount must be greater than zero.");
    const currentSubtotal = Math.max(ticket.subtotal - ticket.discount_total, 0);
    if (addItemMode === "discount" && amount > currentSubtotal) throw new Error("Discount cannot make the ticket total negative.");
    const itemType: TicketLineInput["item_type"] = addItemMode === "labor" ? "custom" : addItemMode;
    const nextLine: TicketLineInput = {
      service_id: null,
      item_type: editingItem?.item_type === "inventory" ? "inventory" : itemType,
      package_id: null,
      inventory_item_id: editingItem?.inventory_item_id ?? null,
      name: lineForm.name.trim(),
      quantity,
      unit_price: addItemMode === "discount" ? -amount : amount,
      taxable: lineForm.taxable ? 1 : 0
    };
    if (editingItem) await updateTicketItem(ticket.id, editingItem.id, nextLine, taxRate);
    else await addTicketItem(ticket.id, nextLine, taxRate);
    closeLineModal();
  }, editingItem ? "Line item updated." : "Line item added.");

  const addInventoryItemToTicket = (item: InventoryItem) => runAction(async () => {
    const quantity = Math.max(Number(inventoryQuantity) || 1, 0.01);
    await addTicketItem(ticket.id, {
      service_id: null,
      item_type: "inventory",
      package_id: null,
      inventory_item_id: item.id,
      cost: item.cost,
      sku: item.sku,
      product_id: item.product_id ?? item.sku,
      source_price_type: "inventory_retail",
      name: item.name,
      quantity,
      unit_price: item.retail_price,
      taxable: item.tax_exempt ? 0 : 1
    }, taxRate);
    resetAddItemState();
  }, `${item.name} added.`);

  const changeLineQuantity = (item: TicketItem, quantity: number) => runAction(async () => {
    await updateTicketItemQuantity(ticket.id, item.id, quantity, taxRate);
  }, `${item.name} quantity updated.`);

  const addPayment = async (input: { amount: number; method: Payment["method"]; payment_subtype: string | null; reference: string | null; memo: string | null; finalize: boolean }) => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await createPaymentAndRefreshTicket({
        ticket_id: ticket.id,
        amount: input.amount,
        method: input.method,
        payment_subtype: input.payment_subtype,
        status: "paid",
        reference: input.reference,
        memo: input.memo
      });
      if (input.finalize) {
        if (result.summary.paymentStatus !== "paid") throw new Error("Invoice must be paid in full before finalizing.");
        if (!finalMileage || !Number.isFinite(Number(finalMileage))) throw new Error("Final mileage is required before finalizing.");
        await finalizeTicket(ticket.id, { finalMileage: Number(finalMileage), oilType: oilType.trim() || null });
      }
      notify({ tone: "success", title: "Payment saved", message: `${input.method} payment recorded for ${invoiceNumber}.` });
      setPaymentModalOpen(false);
      loadTicket();
    } finally {
      setSaving(false);
    }
  };

  const finalizeOrder = () => runAction(async () => {
    const finalizeValidation = validateCanFinalizeTicket({ ...ticket, payment_status: paymentSummary?.paymentStatus ?? ticket.payment_status });
    if (!finalizeValidation.valid) throw new Error(finalizeValidation.message ?? "Add payment before finalizing.");
    if (!finalMileage || !Number.isFinite(Number(finalMileage))) throw new Error("Final mileage is required.");
    if (!window.confirm(`Finalize invoice ${invoiceNumber}? Completed tickets are locked from normal editing.`)) return;
    await finalizeTicket(ticket.id, { finalMileage: Number(finalMileage), oilType: oilType.trim() || null });
  }, "Order finalized.");

  const applyCoupon = (couponId: string) => runAction(async () => {
    await applyCouponToTicket(ticket.id, couponId);
  }, "Coupon applied.");

  const removeCoupon = (couponId: string) => runAction(async () => {
    await removeCouponFromTicket(ticket.id, couponId);
  }, "Coupon removed.");

  const useFreeOilChangeReward = () => runAction(async () => {
    if (!ticket.customer_id || !ticket.vehicle_id) throw new Error("Customer and vehicle are required.");
    if (!punchCard || punchCard.free_rewards_available <= 0) throw new Error("No free oil change reward is available for this vehicle.");
    const coupon = await createFreeOilChangeCoupon(ticket.customer_id, punchCard.id);
    await applyCouponToTicket(ticket.id, coupon.id);
  }, "Free oil change reward applied.");

  const openPrintPreview = async (type: "window_sticker" | "invoice" | "receipt") => {
    try {
      const job = type === "window_sticker"
        ? await createWindowStickerPrintJob(ticket.id)
        : type === "invoice"
          ? await createInvoicePrintJob(ticket.id)
          : await createReceiptPrintJob(ticket.id);
      await markPrintJobPreviewed(job.id);
      const previewed = { ...job, status: "previewed" as const };
      setActivePrintJob(previewed);
      setPrintJobs((current) => [previewed, ...current]);
      notify({ tone: "success", title: "Print preview ready", message: `${type.replace("_", " ")} print job created.` });
    } catch (err) {
      notify({ tone: "error", title: "Print preview failed", message: err instanceof Error ? err.message : "Unable to create print job." });
    }
  };

  const printActiveJob = () => {
    if (!activePrintJob) return;
    printWindowHtml(activePrintJob.rendered_html ?? "");
  };

  const markActivePrintJobPrinted = async () => {
    if (!activePrintJob) return;
    await markPrintJobPrinted(activePrintJob.id);
    notify({ tone: "success", title: "Print job marked printed", message: activePrintJob.document_type.replace("_", " ") });
    setActivePrintJob(null);
    listPrintJobsByTicket(ticket.id).then(setPrintJobs).catch(() => undefined);
  };

  const confirmCancelTicket = () => {
    if (!window.confirm(`Cancel invoice ${invoiceNumber}? This keeps the ticket record but removes it from active workflow.`)) return;
    void runAction(() => cancelTicket(ticket.id), "Ticket canceled.");
  };

  const openBaySelection = async () => {
    if (!canUseBayAction) return;
    try {
      const rows = await listActiveTickets();
      setActiveBayTickets(rows);
      const bayOptions: BayName[] = ["Bay 1", "Bay 2"];
      const emptyTarget = bayOptions.find((option) => option !== ticket.bay && !rows.some((row) => row.status === "in_service" && row.bay === option && row.id !== ticket.id))
        ?? bayOptions.find((option) => !rows.some((row) => row.status === "in_service" && row.bay === option && row.id !== ticket.id))
        ?? "Bay 1";
      setSelectedBay(emptyTarget);
      setBayModalOpen(true);
    } catch (err) {
      notify({ tone: "error", title: "Unable to load bays", message: err instanceof Error ? err.message : "Try again from Active Bays." });
    }
  };

  const assignSelectedBay = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await sendTicketToBay(ticket.id, selectedBay);
      setBayModalOpen(false);
      const message = bayActionLabel === "Move Bay" ? `Moved to ${selectedBay}.` : bayActionLabel === "Send Back to Bay" ? `Sent back to ${selectedBay}.` : `Sent to ${selectedBay}.`;
      notify({ tone: "success", title: "Ticket updated", message });
      const needsFirstSticker = bayActionLabel === "Send to Bay" && !ticket.bay && !printJobs.some((job) => job.document_type === "window_sticker");
      loadTicket();
      if (needsFirstSticker) void openPrintPreview("window_sticker");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to assign bay.";
      setError(message);
      notify({ tone: "error", title: "Bay assignment failed", message });
    } finally {
      setSaving(false);
    }
  };

  const renderBayActionButton = (className = "") => {
    if (!canUseBayAction) return null;
    return <Button className={className} disabled={saving} icon={<Play size={16} />} onClick={() => void openBaySelection()}>{bayActionLabel}</Button>;
  };

  const renderNextActionPanel = () => {
    if (ticket.status === "checked_in") {
      return (
        <div className="grid gap-3">
          {renderBayActionButton("w-full")}
          <Button disabled={saving} variant="danger" icon={<XCircle size={16} />} onClick={confirmCancelTicket}>Cancel Ticket</Button>
        </div>
      );
    }
    if (ticket.status === "in_service") {
      return (
        <div className="grid gap-3">
          {renderBayActionButton("w-full")}
          <Button disabled={saving} size="touch" icon={<CheckCircle2 size={16} />} onClick={() => runAction(() => markWaitingPayment(ticket.id), "Moved to waiting payment.")}>Mark Waiting Payment</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("window_sticker")}>Reprint Sticker</Button>
          <Button disabled={saving} variant="danger" icon={<XCircle size={16} />} onClick={confirmCancelTicket}>Cancel Ticket</Button>
        </div>
      );
    }
    if (ticket.status === "waiting_payment" && displayPaymentStatus === "paid") {
      return (
        <div className="grid gap-3">
          {renderBayActionButton("w-full")}
          <Button disabled={saving} size="touch" variant="success" icon={<CheckCircle2 size={16} />} onClick={finalizeOrder}>Finalize Order</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("invoice")}>Print Invoice</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("receipt")}>Print Receipt</Button>
        </div>
      );
    }
    if (ticket.status === "waiting_payment") {
      return (
        <div className="grid gap-3">
          {renderBayActionButton("w-full")}
          <Button size="touch" icon={<CreditCard size={16} />} onClick={() => setPaymentModalOpen(true)}>Add Payment</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("invoice")}>Print Invoice</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("window_sticker")}>Reprint Sticker</Button>
          <Button disabled={saving} variant="danger" icon={<XCircle size={16} />} onClick={confirmCancelTicket}>Cancel Ticket</Button>
        </div>
      );
    }
    if (ticket.status === "completed") {
      return (
        <div className="grid gap-3">
          <Button size="touch" icon={<Printer size={16} />} onClick={() => void openPrintPreview("receipt")}>Print Receipt</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("invoice")}>Print Invoice</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("window_sticker")}>Reprint Sticker</Button>
          <Button variant="secondary" icon={<History size={16} />} onClick={() => setActiveTab("history")}>View History</Button>
        </div>
      );
    }
    if (ticket.status === "canceled") {
      return (
        <div className="grid gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">This ticket is canceled. No customer-facing actions are available.</div>
          <Button disabled={saving} icon={<RotateCcw size={16} />} onClick={() => runAction(() => reopenTicket(ticket.id), "Ticket reopened.")}>Reopen Ticket</Button>
        </div>
      );
    }
    return <div className="text-sm text-[var(--pos-muted)]">No next action is available for this ticket state.</div>;
  };

  const renderAddItemMenu = () => {
    if (!canEditTicketItems) return null;
    return (
      <div className="relative">
        <Button className="w-full" variant="secondary" icon={<PackagePlus size={16} />} onClick={() => setAddItemOpen((open) => !open)}>Add Item</Button>
        {addItemOpen ? (
          <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-white p-2 shadow-xl">
            <MenuButton label="Inventory Item" onClick={() => { setAddItemOpen(false); setAddItemMode("inventory"); }} />
            <MenuButton label="Labor" onClick={() => openLineModal("labor")} />
            <MenuButton label="Discount" onClick={() => openLineModal("discount")} />
            {activeCoupons.length > 0 ? <MenuButton label="Coupon" onClick={() => { setAddItemOpen(false); setAddItemMode("coupon"); }} /> : null}
            <MenuButton label="Fee" onClick={() => openLineModal("fee")} />
            <MenuButton label="Custom Item" onClick={() => openLineModal("custom")} />
          </div>
        ) : null}
      </div>
    );
  };

  const bayOptions: BayName[] = ["Bay 1", "Bay 2"];
  const getBayOccupant = (bayName: BayName) => activeBayTickets.find((row) => row.status === "in_service" && row.bay === bayName && row.id !== ticket.id) ?? null;
  const selectedBayOccupant = getBayOccupant(selectedBay);
  const selectedBayIsCurrent = ticket.status === "in_service" && ticket.bay === selectedBay;
  const assignButtonLabel = bayActionLabel === "Move Bay" ? "Move to Bay" : "Assign to Bay";

  return (
    <section className="mx-auto max-w-[1480px] space-y-5">
      <Card className="no-print px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => onBack(backDestination)}>{backDestination.label}</Button>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Ticket Detail</div>
              <h1 className="mt-1 text-2xl font-black text-[var(--pos-text)] sm:text-3xl">Invoice # {invoiceNumber}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(ticket.status)}>{statusLabels[ticket.status]}</Badge>
                <Badge tone={paymentTone(displayPaymentStatus)}>{displayPaymentStatus.replace("_", " ")}</Badge>
                {ticket.bay ? <Badge tone="blue">{ticket.bay}</Badge> : null}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-[var(--pos-muted)]">
            <div>Created <strong className="text-[var(--pos-text)]">{formatDateTime(ticket.created_at)}</strong></div>
            {ticket.completed_at ? <div className="mt-1">Completed <strong className="text-[var(--pos-text)]">{formatDateTime(ticket.completed_at)}</strong></div> : null}
          </div>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      </Card>

      <Card className="no-print p-3">
        <div className="flex flex-wrap items-center gap-2">
          {renderAddItemMenu()}
          {renderBayActionButton()}
          {ticket.status === "in_service" ? <Button disabled={saving} icon={<CheckCircle2 size={16} />} onClick={() => runAction(() => markWaitingPayment(ticket.id), "Moved to waiting payment.")}>Mark Waiting Payment</Button> : null}
          {ticket.status === "waiting_payment" && displayPaymentStatus !== "paid" ? <Button icon={<CreditCard size={16} />} onClick={() => setPaymentModalOpen(true)}>Add Payment</Button> : null}
          {ticket.status === "waiting_payment" && displayPaymentStatus === "paid" ? <Button disabled={saving} variant="success" icon={<CheckCircle2 size={16} />} onClick={finalizeOrder}>Finalize Order</Button> : null}
          {ticket.status === "completed" ? <Button icon={<Printer size={16} />} onClick={() => void openPrintPreview("receipt")}>Print Receipt</Button> : null}
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("invoice")}>Print Invoice</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("window_sticker")}>Reprint Sticker</Button>
          {(ticket.status === "in_service" || ticket.status === "waiting_payment" || ticket.status === "checked_in") ? <Button disabled={saving} variant="danger" icon={<XCircle size={16} />} onClick={confirmCancelTicket}>Cancel</Button> : null}
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
        <Card className="p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--pos-radius-md)] px-4 text-sm font-black transition ${activeTab === tab.id ? "bg-[var(--pos-blue)] text-white" : "text-[var(--pos-muted)] hover:bg-[var(--pos-blue-soft)] hover:text-[var(--pos-text)]"}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </Card>

      {activeTab === "invoice" ? (
        <div className="space-y-5">
          <div className="rounded-[28px] bg-[#EEF2F7] p-3 sm:p-5">
            <ModernInvoicePreview
              ticket={ticket}
              businessProfile={businessProfile}
              invoiceNumber={invoiceNumber}
              employeeName={employeeName}
              payments={payments}
              paidAmount={paidAmount}
              balanceDue={balanceDue}
              displayPaymentStatus={displayPaymentStatus}
              punchCard={punchCard}
              editable={canEditTicketItems}
              onQuantityChange={changeLineQuantity}
            />
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--pos-text)]">Invoice Controls</h2>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Customer-facing invoice preview stays clean; ticket editing tools are grouped here.</p>
              </div>
              {!locked && ticket.status !== "canceled" ? <Button variant="secondary" onClick={() => setActiveTab("internal")}>Edit Items</Button> : null}
            </div>
            {ticket.packageDetails ? (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm md:grid-cols-4">
                <div><span className="text-[var(--pos-muted)]">Package</span><div className="font-black">{ticket.packageDetails.package_name}</div></div>
                <div><span className="text-[var(--pos-muted)]">Oil</span><div className="font-black">{ticket.packageDetails.oil_type ?? "Not recorded"}</div></div>
                <div><span className="text-[var(--pos-muted)]">Quarts</span><div className="font-black">{ticket.packageDetails.actual_quarts} qt</div></div>
                <div><span className="text-[var(--pos-muted)]">Filter</span><div className="font-black">{ticket.packageDetails.oil_filter_sku ?? ticket.packageDetails.oil_filter_name ?? "Not recorded"}</div></div>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[var(--pos-text)]">Payments</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Invoice {invoiceNumber} · Balance {formatMoney(balanceDue)}</p>
            </div>
            {ticket.status !== "completed" && ticket.status !== "canceled" ? <Button onClick={() => setPaymentModalOpen(true)}>Add Payment</Button> : null}
          </div>
          {payments.length === 0 ? <p className="mt-4 text-sm text-[var(--pos-muted)]">No payments recorded.</p> : (
            <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)]">
              {payments.map((payment) => (
                <div key={payment.id} className="grid gap-2 p-3 text-sm md:grid-cols-[180px_120px_120px_1fr]">
                  <div className="font-bold text-[var(--pos-text)]">{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "No date"}</div>
                  <div>{payment.payment_subtype ? `${payment.method} · ${payment.payment_subtype}` : payment.method}</div>
                  <div className="font-black">{formatMoney(payment.amount)}</div>
                  <div className="text-[var(--pos-muted)]">{payment.status}{payment.reference ? ` · Ref ${payment.reference}` : ""}{payment.memo ? ` · ${payment.memo}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === "history" ? (
        <Card className="p-5">
          <h2 className="text-xl font-black text-[var(--pos-text)]">Vehicle Service History</h2>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--pos-muted)]">No service history recorded for this vehicle yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)]">
              {history.map((entry) => (
                <div key={entry.id} className="grid gap-2 p-3 text-sm md:grid-cols-[170px_130px_1fr]">
                  <div className="font-bold text-[var(--pos-text)]">{new Date(entry.service_date).toLocaleDateString()}</div>
                  <div>{entry.mileage.toLocaleString()} mi</div>
                  <div className="text-[var(--pos-muted)]">{entry.oil_type ?? "Oil type not set"} · {entry.notes ?? "Service completed"}</div>
                </div>
              ))}
            </div>
          )}
          {locked && ticket.vehicle_id ? (
            <Button className="mt-4" onClick={() => { setStartTicketContext({ vehicleId: ticket.vehicle_id ?? undefined, customerId: ticket.customer_id ?? undefined, source: "order_detail" }); onStartTicket?.(); }}>New Ticket Same Vehicle</Button>
          ) : null}
        </Card>
      ) : null}

      {activeTab === "notes" ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[var(--pos-text)]">Notes</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Customer-facing and internal notes are kept out of the invoice preview.</p>
            </div>
            {!locked ? <Button onClick={saveNotes}>Save Notes</Button> : null}
          </div>
          <div className="mt-4 grid gap-3">
            <Input label="Customer concern" disabled={locked} value={notesForm.customer_concern} onChange={(event) => setNotesForm({ ...notesForm, customer_concern: event.target.value })} />
            <Input label="Technician notes" disabled={locked} value={notesForm.technician_notes} onChange={(event) => setNotesForm({ ...notesForm, technician_notes: event.target.value })} />
            <Input label="Internal notes" disabled={locked} value={notesForm.internal_notes} onChange={(event) => setNotesForm({ ...notesForm, internal_notes: event.target.value })} />
          </div>
        </Card>
      ) : null}

      {activeTab === "internal" ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[var(--pos-text)]">Internal / Audit</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Operational editing, coupons, print history, and internal metadata.</p>
            </div>
            <Badge tone={locked ? "green" : "blue"}>{locked ? "Read-only" : "Editable"}</Badge>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
            <div className="font-black text-[var(--pos-text)]">Coupons & Rewards</div>
            <div className="mt-1 text-sm text-[var(--pos-muted)]">{getRewardSummary({ coupons: activeCoupons, punchCard })}</div>
            {punchCard?.free_rewards_available && !locked && ticket.status !== "canceled" ? (
              <Button className="mt-3" size="sm" onClick={useFreeOilChangeReward}>Use Free Oil Change Reward</Button>
            ) : null}
            {activeApplications.length ? (
              <div className="mt-3 space-y-2">
                {activeApplications.map((application) => (
                  <div key={application.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 py-2 text-sm">
                    <span><strong>{application.discount_type.replace("_", " ")}</strong> · {formatMoney(application.calculated_discount)} · {application.status}</span>
                    {application.status === "applied" && !locked ? <Button size="sm" variant="secondary" onClick={() => removeCoupon(application.coupon_id)}>Remove</Button> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {!locked && ticket.status !== "canceled" ? (
              <div className="mt-3 grid gap-2">
                {activeCoupons.length ? activeCoupons.map((coupon) => (
                  <div key={coupon.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 py-2 text-sm">
                    <span><strong>{coupon.title}</strong> · {coupon.discount_type === "fixed" ? formatMoney(coupon.discount_amount) : coupon.discount_type === "percent" ? `${coupon.discount_amount}%` : "Free oil change"}</span>
                    <Button size="sm" onClick={() => applyCoupon(coupon.id)}>Apply Coupon</Button>
                  </div>
                )) : <div className="text-sm text-[var(--pos-muted)]">No active customer coupons.</div>}
              </div>
            ) : null}
          </div>

          {!locked ? (
            <div className="mt-5 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
              <div className="font-black text-[var(--pos-text)]">Add Custom Item</div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_90px_120px_110px_auto]">
                <Input label="Item" value={customItem.name} onChange={(event) => setCustomItem({ ...customItem, name: event.target.value })} />
                <Input label="Qty" type="number" value={customItem.quantity} onChange={(event) => setCustomItem({ ...customItem, quantity: event.target.value })} />
                <Input label="Price" type="number" step="0.01" value={customItem.unit_price} onChange={(event) => setCustomItem({ ...customItem, unit_price: event.target.value })} />
                <label className="mt-7 flex items-center gap-2 text-sm text-[var(--pos-muted)]"><input type="checkbox" checked={customItem.taxable} onChange={(event) => setCustomItem({ ...customItem, taxable: event.target.checked })} />Taxable</label>
                <Button className="mt-7" onClick={addCustomItem}>Add Item</Button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--pos-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--pos-panel-2)] text-left text-xs uppercase tracking-wide text-[var(--pos-muted)]">
                <tr>
                  <th className="px-4 py-3">Line Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {ticket.items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--pos-border)]">
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    <td className="px-4 py-3 text-[var(--pos-muted)]">{item.item_type ?? "item"}</td>
                    <td className="px-4 py-3 text-right font-black">{formatMoney(item.line_total)}</td>
                    <td className="px-4 py-3 text-right">
                      {canEditTicketItems ? (
                        <div className="flex justify-end gap-2">
                          {item.item_type !== "package" ? <Button size="sm" variant="secondary" onClick={() => openLineModal(item.item_type === "fee" ? "fee" : item.item_type === "discount" ? "discount" : item.item_type === "inventory" ? "custom" : "custom", item)}>Edit</Button> : null}
                          <Button size="sm" variant="danger" onClick={() => {
                            if (item.item_type === "package" && !window.confirm("Remove the main package line from this ticket?")) return;
                            void runAction(() => removeTicketItem(ticket.id, item.id, taxRate), "Line item removed.");
                          }}>Remove</Button>
                        </div>
                      ) : <span className="text-xs text-[var(--pos-muted)]">Locked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--pos-border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-black text-[var(--pos-text)]">Print History</div>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Previewed and printed local documents.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void openPrintPreview("window_sticker")}>Sticker</Button>
                <Button size="sm" variant="secondary" onClick={() => void openPrintPreview("invoice")}>Invoice</Button>
                <Button size="sm" variant="secondary" onClick={() => void openPrintPreview("receipt")}>Receipt</Button>
              </div>
            </div>
            {printJobs.length ? (
              <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)]">
                {printJobs.slice(0, 8).map((job) => (
                  <div key={job.id} className="grid gap-2 p-3 text-sm text-[var(--pos-muted)] md:grid-cols-[180px_140px_120px_1fr_auto]">
                    <span className="font-bold text-[var(--pos-text)]">{new Date(job.created_at).toLocaleString()}</span>
                    <span>{job.document_type.replace("_", " ")}</span>
                    <Badge tone={job.status === "printed" ? "green" : job.status === "failed" ? "red" : "blue"}>{job.status}</Badge>
                    <span>{job.printer_model ?? job.print_mode}</span>
                    <Button size="sm" variant="secondary" onClick={() => setActivePrintJob(job)}>Preview</Button>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-[var(--pos-muted)]">No print history for this ticket yet.</p>}
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--pos-border)] p-4">
            <div className="font-black text-[var(--pos-text)]">Audit Events</div>
            {auditEvents.length ? (
              <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-xl border border-[var(--pos-border)]">
                {auditEvents.slice(0, 12).map((event) => (
                  <div key={event.id} className="grid gap-2 p-3 text-sm text-[var(--pos-muted)] md:grid-cols-[170px_180px_1fr]">
                    <span className="font-bold text-[var(--pos-text)]">{new Date(event.created_at).toLocaleString()}</span>
                    <span>{event.actor_name ?? "System"} · {event.action}</span>
                    <span>{event.summary}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-[var(--pos-muted)]">No audit events recorded.</p>}
          </div>
        </Card>
      ) : null}

        </div>

        <aside className="no-print space-y-4">
          <Card className="p-5">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Next Action</div>
            <h2 className="mt-2 text-xl font-black text-[var(--pos-text)]">{statusLabels[ticket.status]}</h2>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">
              {ticket.status === "checked_in" ? "Assign a bay and begin service."
                : ticket.status === "in_service" ? "Move the vehicle to payment when service is complete."
                  : ticket.status === "waiting_payment" && displayPaymentStatus === "paid" ? "Payment is complete. Finalize the order."
                    : ticket.status === "waiting_payment" ? "Collect payment before finalizing."
                      : ticket.status === "completed" ? "Ticket is complete and ready for customer documents."
                        : ticket.status === "canceled" ? "Canceled tickets are retained for history."
                          : "Review this ticket state."}
            </p>
            <div className="mt-4">{renderNextActionPanel()}</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Payment Summary</div>
              <Badge tone={paymentTone(displayPaymentStatus)}>{displayPaymentStatus.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 text-4xl font-black text-[var(--pos-text)]">{formatMoney(balanceDue)}</div>
            <div className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">Amount due</div>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-[var(--pos-muted)]">Invoice total</span><strong>{formatMoney(ticket.total)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--pos-muted)]">Paid</span><strong>{formatMoney(paidAmount)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--pos-muted)]">Last method</span><strong>{payments[0]?.payment_subtype ? `${payments[0].method} · ${payments[0].payment_subtype}` : payments[0]?.method ?? "None"}</strong></div>
            </div>
            {ticket.status !== "completed" && ticket.status !== "canceled" ? (
              <Button className="mt-5 w-full" icon={<CreditCard size={16} />} onClick={() => setPaymentModalOpen(true)}>Add Payment</Button>
            ) : null}
            {ticket.status === "waiting_payment" && displayPaymentStatus !== "paid" ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">Finalize is available after the balance is paid.</div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Customer & Vehicle</div>
            <div className="mt-4 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
              <div className="font-black text-[var(--pos-text)]">{customerName}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{ticket.customer_phone ?? "No phone on file"}</div>
              {punchCard ? <div className="mt-2 text-xs font-bold text-[var(--pos-blue)]">{punchCard.punch_count} of 5 punch-card visits</div> : null}
              {ticket.customer_id && onOpenCustomer ? <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => onOpenCustomer(ticket.customer_id!)}>Open Customer</Button> : null}
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
              <div className="font-black text-[var(--pos-text)]">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle not set"}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{ticket.vehicle_plate ? `Plate ${ticket.vehicle_plate}${ticket.vehicle_plate_state ? ` ${ticket.vehicle_plate_state}` : ""}` : "No plate recorded"}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{ticket.vehicle_vin ? `VIN ${ticket.vehicle_vin}` : "No VIN recorded"}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{ticket.vehicle_mileage ? `${Number(ticket.vehicle_mileage).toLocaleString()} miles` : "Mileage not recorded"}</div>
              {ticket.vehicle_id && onOpenVehicle ? <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => onOpenVehicle(ticket.vehicle_id!)}>Open Vehicle</Button> : null}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Print</div>
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("invoice")}>Print Invoice</Button>
              {(payments.length > 0 || ticket.status === "completed") ? <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("receipt")}>Print Receipt</Button> : null}
              <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void openPrintPreview("window_sticker")}>Reprint Sticker</Button>
            </div>
          </Card>
        </aside>
      </div>

      {bayModalOpen ? (
        <Modal
          title="Select Bay"
          onClose={() => setBayModalOpen(false)}
          footer={(
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => setBayModalOpen(false)}>Cancel</Button>
              <Button disabled={saving || Boolean(selectedBayOccupant) || selectedBayIsCurrent} icon={<Play size={16} />} onClick={() => void assignSelectedBay()}>
                {assignButtonLabel}
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            {ticket.status === "waiting_payment" || displayPaymentStatus === "paid" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Payments stay on this invoice. Sending it back to a bay only changes the workflow status and bay assignment.
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {bayOptions.map((bayName) => {
                const occupant = getBayOccupant(bayName);
                const isCurrent = ticket.status === "in_service" && ticket.bay === bayName;
                const vehicleLabel = occupant ? [occupant.vehicle_year, occupant.vehicle_make, occupant.vehicle_model].filter(Boolean).join(" ") : "";
                const customerLabel = occupant ? [occupant.customer_first_name, occupant.customer_last_name].filter(Boolean).join(" ") || "Walk-in" : "";
                return (
                  <button
                    key={bayName}
                    type="button"
                    disabled={Boolean(occupant)}
                    onClick={() => setSelectedBay(bayName)}
                    className={`min-h-[160px] rounded-2xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] disabled:cursor-not-allowed disabled:opacity-70 ${
                      selectedBay === bayName
                        ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] shadow-sm"
                        : "border-[var(--pos-border)] bg-[var(--pos-card)] hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-black text-[var(--pos-text)]">{bayName}</div>
                        <div className="mt-1 text-sm font-bold text-[var(--pos-muted)]">{occupant ? "Occupied" : isCurrent ? "Current bay" : "Empty"}</div>
                      </div>
                      <Badge tone={occupant ? "red" : isCurrent ? "blue" : "green"}>{occupant ? "Occupied" : isCurrent ? "Current" : "Open"}</Badge>
                    </div>
                    {occupant ? (
                      <div className="mt-4 rounded-xl border border-[var(--pos-border)] bg-white/80 p-3">
                        <div className="font-black text-[var(--pos-text)]">{customerLabel}</div>
                        <div className="mt-1 text-sm text-[var(--pos-muted)]">{vehicleLabel || "Vehicle not set"}</div>
                        <div className="mt-1 text-xs font-bold text-[var(--pos-muted)]">Invoice {getDisplayInvoiceNumber(occupant)}</div>
                      </div>
                    ) : (
                      <div className="mt-4 text-sm font-semibold text-[var(--pos-muted)]">
                        {isCurrent ? "This ticket is already assigned here." : "Available for this ticket."}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedBayOccupant ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{selectedBay} is already occupied.</div>
            ) : selectedBayIsCurrent ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">This ticket is already in {selectedBay}. Select the other bay to move it.</div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {addItemMode === "inventory" ? (
        <Modal
          title="Add Inventory Item to Ticket"
          onClose={closeLineModal}
          footer={<div className="flex justify-end"><Button variant="secondary" onClick={closeLineModal}>Close</Button></div>}
        >
          <div className="space-y-4">
            <Input label="Search inventory" inputSize="touch" placeholder="Product ID, SKU, barcode, name, brand, category..." value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              {[
                ["Oil Filters", "oilFilters"],
                ["Engine Oil", "engineOil"],
                ["Air Filters", "airFilters"],
                ["Cabin Filters", "cabinFilters"],
                ["Wipers", "wipers"],
                ["Fluids", "fluids"],
                ["Other", null]
              ].map(([label, key]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setInventoryFilter(key as keyof InventorySearchFilters | null)}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-black ${inventoryFilter === key ? "border-[var(--pos-blue)] bg-[var(--pos-blue)] text-white" : "border-[var(--pos-border)] bg-white text-[var(--pos-muted)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Input className="max-w-36" label="Quantity" type="number" min="0.01" step="0.01" value={inventoryQuantity} onChange={(event) => setInventoryQuantity(event.target.value)} />
            <div className="space-y-2">
              {inventoryResults.length === 0 ? <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm text-[var(--pos-muted)]">No inventory items found.</div> : null}
              {inventoryResults.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--pos-border)] bg-white p-4">
                  <div className="min-w-0">
                    <div className="font-black text-[var(--pos-text)]">{item.name}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{[item.brand ?? item.vendor ?? item.supplier, item.sku ?? item.product_id, item.category || item.product_type].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.quantity_on_hand} on hand</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-[var(--pos-text)]">{formatMoney(item.retail_price)}</div>
                    <Button className="mt-2" size="sm" onClick={() => addInventoryItemToTicket(item)}>Add</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}

      {addItemMode === "labor" || addItemMode === "discount" || addItemMode === "fee" || addItemMode === "custom" ? (
        <Modal
          title={`${editingItem ? "Edit" : "Add"} ${addItemMode === "custom" ? "Custom Item" : addItemMode[0].toUpperCase() + addItemMode.slice(1)}`}
          onClose={closeLineModal}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={closeLineModal}>Cancel</Button>
              <Button disabled={saving} onClick={saveLineItemModal}>{editingItem ? "Save Changes" : "Add Item"}</Button>
            </div>
          }
        >
          <div className="grid gap-4">
            {addItemMode === "fee" ? (
              <TouchSelect label="Fee type" value={lineForm.name} onChange={(name) => setLineForm({ ...lineForm, name })} options={["Shop Fee", "Environmental Fee", "Disposal Fee", "Misc Fee"].map((item) => ({ value: item, label: item }))} />
            ) : addItemMode === "discount" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <TouchSelect label="Discount type" value={lineForm.discountType} onChange={(discountType) => setLineForm({ ...lineForm, discountType: discountType as "dollar" | "percent" })} options={[{ value: "dollar", label: "Dollar Amount" }, { value: "percent", label: "Percent" }]} />
                <TouchSelect label="Reason" value={lineForm.name} onChange={(name) => setLineForm({ ...lineForm, name })} options={["Manager Discount", "Coupon Match", "Customer Satisfaction", "Employee", "Other Discount"].map((item) => ({ value: item, label: item }))} />
              </div>
            ) : (
              <Input label={addItemMode === "labor" ? "Labor description" : "Item name"} inputSize="touch" value={lineForm.name} onChange={(event) => setLineForm({ ...lineForm, name: event.target.value })} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={addItemMode === "labor" ? "Hours / Qty" : "Quantity"} type="number" min="0.01" step="0.01" value={lineForm.quantity} onChange={(event) => setLineForm({ ...lineForm, quantity: event.target.value })} />
              <Input label={addItemMode === "discount" ? (lineForm.discountType === "percent" ? "Percent" : "Discount amount") : addItemMode === "labor" ? "Rate" : "Unit price"} type="number" min="0" step="0.01" value={lineForm.unit_price} onChange={(event) => setLineForm({ ...lineForm, unit_price: event.target.value })} />
            </div>
            {addItemMode !== "discount" ? (
              <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={lineForm.taxable} onChange={(event) => setLineForm({ ...lineForm, taxable: event.target.checked })} />
                Taxable
              </label>
            ) : null}
            <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
              <div className="text-sm text-[var(--pos-muted)]">Line total preview</div>
              <div className={`mt-1 text-3xl font-black ${addItemMode === "discount" ? "text-green-700" : "text-[var(--pos-text)]"}`}>
                {addItemMode === "discount" ? "-" : ""}{formatMoney(addItemMode === "discount" && lineForm.discountType === "percent" ? Math.max(ticket.subtotal - ticket.discount_total, 0) * Math.min(Number(lineForm.unit_price) || 0, 100) / 100 : (Number(lineForm.quantity) || 1) * (Number(lineForm.unit_price) || 0))}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {addItemMode === "coupon" ? (
        <Modal title="Apply Coupon" onClose={closeLineModal} footer={<div className="flex justify-end"><Button variant="secondary" onClick={closeLineModal}>Close</Button></div>}>
          <div className="space-y-3">
            {activeCoupons.length === 0 ? <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm text-[var(--pos-muted)]">No active coupons for this customer.</div> : null}
            {activeCoupons.map((coupon) => (
              <div key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--pos-border)] bg-white p-4">
                <div>
                  <div className="font-black text-[var(--pos-text)]">{coupon.title}</div>
                  <div className="mt-1 text-sm text-[var(--pos-muted)]">{coupon.discount_type === "fixed" ? formatMoney(coupon.discount_amount) : coupon.discount_type === "percent" ? `${coupon.discount_amount}%` : "Free oil change"} · {coupon.source}</div>
                </div>
                <Button onClick={() => { closeLineModal(); void applyCoupon(coupon.id); }}>Apply</Button>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}

      {paymentModalOpen ? (
        <AddPaymentModal
          total={ticket.total}
          paid={paidAmount}
          ticketStatus={ticket.status}
          customerName={customerName}
          customerEmail={ticket.customer_email}
          customerPhone={ticket.customer_phone}
          invoiceNumber={invoiceNumber}
          loading={saving}
          onClose={() => setPaymentModalOpen(false)}
          onSave={addPayment}
        />
      ) : null}
      {activePrintJob ? (
        <PrintPreviewModal
          title={activePrintJob.document_type === "window_sticker" ? "Window Sticker Preview" : activePrintJob.document_type === "invoice" ? "Invoice Preview" : "Receipt Preview"}
          printJob={activePrintJob}
          onPrint={printActiveJob}
          onMarkPrinted={() => void markActivePrintJobPrinted()}
          onClose={() => setActivePrintJob(null)}
        >
          {activePrintJob.document_type === "window_sticker" ? (
            <WindowStickerPrintView payload={JSON.parse(activePrintJob.payload_json) as WindowStickerPayload} />
          ) : activePrintJob.document_type === "invoice" ? (
            <InvoicePrintView payload={JSON.parse(activePrintJob.payload_json) as InvoicePayload} />
          ) : (
            <ReceiptPrintView payload={JSON.parse(activePrintJob.payload_json) as ReceiptPayload} />
          )}
        </PrintPreviewModal>
      ) : null}
    </section>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-black text-[var(--pos-text)] transition hover:bg-[var(--pos-blue-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
    >
      <DollarSign size={16} className="text-[var(--pos-blue)]" />
      {label}
    </button>
  );
}
