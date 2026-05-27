import { getBusinessProfile } from "../config/businessProfile";
import { createPrintJob, getPrintJobById, markPrinted, updatePrintJobStatus } from "../db/repositories/printJobsRepo";
import { getPaymentsByTicket } from "../db/repositories/paymentsRepo";
import { getTicketById } from "../db/repositories/ticketsRepo";
import { getDisplayInvoiceNumber } from "../domain/invoices/invoiceNumber";
import { nowIso } from "../utils/dates";
import { buildGodexEzplWindowStickerCommand } from "./godexRt200iTemplate";
import { renderInvoiceHtml } from "./invoiceTemplate";
import { getPrintSettings } from "./printSettings";
import { renderReceiptHtml } from "./receiptTemplate";
import { renderWindowStickerHtml } from "./windowStickerTemplate";
import type { InvoicePayload, PrintJob, PrintableTicketPayload, ReceiptPayload, WindowStickerPayload } from "./printTypes";
import { toPrintablePayment, toPrintLineItem } from "./printTypes";

function addMonths(value: string, months: number): string {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function vehicleLabel(ticket: PrintableTicketPayload["ticket"]): string {
  return [ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
}

async function buildBasePayload(ticketId: string): Promise<PrintableTicketPayload> {
  const [ticket, payments, business] = await Promise.all([
    getTicketById(ticketId),
    getPaymentsByTicket(ticketId),
    getBusinessProfile()
  ]);
  if (!ticket) throw new Error("Ticket not found.");
  const paidTotal = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return {
    business,
    ticket,
    items: ticket.items.map(toPrintLineItem),
    payments: payments.map(toPrintablePayment),
    paidTotal,
    balanceDue: Math.max(Number(ticket.total || 0) - paidTotal, 0),
    createdAt: ticket.created_at,
    serviceDate: ticket.completed_at ?? ticket.started_at ?? ticket.created_at
  };
}

export async function buildWindowStickerPayload(ticketId: string): Promise<WindowStickerPayload> {
  const [base, settings] = await Promise.all([buildBasePayload(ticketId), getPrintSettings()]);
  const details = base.ticket.packageDetails;
  const mileage = base.ticket.vehicle_mileage ?? null;
  return {
    ...base,
    sticker: {
      businessName: base.business.business_name,
      shopPhone: settings.show_shop_phone ? base.business.phone || null : null,
      serviceDate: base.serviceDate,
      nextServiceDate: addMonths(base.serviceDate, settings.next_service_months),
      currentMileage: mileage,
      nextServiceMileage: mileage === null ? null : mileage + settings.next_service_miles,
      vehicleLabel: vehicleLabel(base.ticket),
      plate: settings.show_plate ? [base.ticket.vehicle_plate, base.ticket.vehicle_plate_state].filter(Boolean).join(" ") || null : null,
      vinLast8: settings.show_vin_last8 && base.ticket.vehicle_vin ? base.ticket.vehicle_vin.slice(-8) : null,
      oilType: details?.oil_type ?? base.ticket.vehicle_oil_type ?? null,
      actualQuarts: settings.show_quarts ? details?.actual_quarts ?? null : null,
      oilFilterLabel: settings.show_filter ? [details?.oil_filter_sku, details?.oil_filter_name].filter(Boolean).join(" · ") || null : null,
      ticketId: getDisplayInvoiceNumber(base.ticket),
      technician: null,
      disclaimer: base.business.invoice_footer
    }
  };
}

export async function buildInvoicePayload(ticketId: string): Promise<InvoicePayload> {
  const [base, settings] = await Promise.all([buildBasePayload(ticketId), getPrintSettings()]);
  return {
    ...base,
    invoiceNumber: getDisplayInvoiceNumber(base.ticket),
    footer: settings.invoice_footer,
    showRewards: settings.invoice_show_rewards,
    showDisclaimer: settings.invoice_show_disclaimer
  };
}

export async function buildReceiptPayload(ticketId: string): Promise<ReceiptPayload> {
  const [base, settings] = await Promise.all([buildBasePayload(ticketId), getPrintSettings()]);
  return {
    ...base,
    receiptNumber: getDisplayInvoiceNumber(base.ticket),
    footer: settings.receipt_footer,
    showVehicle: settings.receipt_show_vehicle,
    showRewards: settings.receipt_show_rewards
  };
}

export async function createWindowStickerPrintJob(ticketId: string): Promise<PrintJob> {
  const [payload, settings] = await Promise.all([buildWindowStickerPayload(ticketId), getPrintSettings()]);
  const raw = settings.sticker_printer_language === "EZPL" ? buildGodexEzplWindowStickerCommand(payload, settings) : null;
  return createPrintJob({
    ticket_id: ticketId,
    document_type: "window_sticker",
    print_mode: settings.default_print_mode,
    printer_model: settings.sticker_printer_model,
    printer_language: settings.sticker_printer_language,
    template_id: settings.default_sticker_template,
    payload_json: JSON.stringify(payload),
    rendered_html: renderWindowStickerHtml(payload),
    raw_command: raw
  });
}

export async function createInvoicePrintJob(ticketId: string): Promise<PrintJob> {
  const [payload, settings] = await Promise.all([buildInvoicePayload(ticketId), getPrintSettings()]);
  return createPrintJob({
    ticket_id: ticketId,
    document_type: "invoice",
    print_mode: settings.default_print_mode,
    template_id: settings.default_invoice_template,
    payload_json: JSON.stringify(payload),
    rendered_html: renderInvoiceHtml(payload)
  });
}

export async function createReceiptPrintJob(ticketId: string): Promise<PrintJob> {
  const [payload, settings] = await Promise.all([buildReceiptPayload(ticketId), getPrintSettings()]);
  return createPrintJob({
    ticket_id: ticketId,
    document_type: "receipt",
    print_mode: settings.default_print_mode,
    template_id: settings.default_receipt_template,
    payload_json: JSON.stringify(payload),
    rendered_html: renderReceiptHtml(payload)
  });
}

export function renderPrintJobHtml(printJob: PrintJob): string {
  return printJob.rendered_html ?? "";
}

export async function markPrintJobPreviewed(id: string): Promise<void> {
  await updatePrintJobStatus(id, "previewed", null);
}

export async function markPrintJobPrinted(id: string): Promise<void> {
  await markPrinted(id);
}

export async function createOrReuseLatestPrintJob(ticketId: string, type: "invoice" | "receipt" | "window_sticker"): Promise<PrintJob> {
  if (type === "invoice") return createInvoicePrintJob(ticketId);
  if (type === "receipt") return createReceiptPrintJob(ticketId);
  return createWindowStickerPrintJob(ticketId);
}

export async function refreshPrintJob(id: string): Promise<PrintJob> {
  const job = await getPrintJobById(id);
  if (!job) throw new Error("Print job not found.");
  return job;
}

export function printWindowHtml(html: string): void {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`<!doctype html><html><head><title>Print ${nowIso()}</title></head><body>${html}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
