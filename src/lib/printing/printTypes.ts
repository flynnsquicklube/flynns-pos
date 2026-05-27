import type { Payment } from "../../types/payment";
import type { TicketItem, TicketWithDetails } from "../../types/ticket";
import type { BusinessProfile } from "../config/businessProfile";

export type PrintDocumentType = "window_sticker" | "invoice" | "receipt";
export type PrintJobStatus = "created" | "previewed" | "printed" | "failed" | "canceled";
export type PrintMode = "preview_only" | "system_dialog" | "direct_raw_coming_soon";
export type StickerPrinterLanguage = "EZPL" | "GEPL" | "GZPL";

export interface PrintJob {
  id: string;
  ticket_id: string | null;
  document_type: PrintDocumentType;
  status: PrintJobStatus;
  print_mode: PrintMode;
  printer_model: string | null;
  printer_language: string | null;
  template_id: string | null;
  payload_json: string;
  rendered_html: string | null;
  raw_command: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  printed_at: string | null;
  created_by: string | null;
}

export interface PrintLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  itemType: string | null;
  sku?: string | null;
  productId?: string | null;
}

export interface PrintablePayment {
  method: string;
  amount: number;
  paidAt: string;
  reference?: string | null;
}

export interface PrintableTicketPayload {
  business: BusinessProfile;
  ticket: TicketWithDetails;
  items: PrintLineItem[];
  payments: PrintablePayment[];
  paidTotal: number;
  balanceDue: number;
  createdAt: string;
  serviceDate: string;
}

export interface WindowStickerPayload extends PrintableTicketPayload {
  sticker: {
    businessName: string;
    shopPhone: string | null;
    serviceDate: string;
    nextServiceDate: string;
    currentMileage: number | null;
    nextServiceMileage: number | null;
    vehicleLabel: string;
    plate: string | null;
    vinLast8: string | null;
    oilType: string | null;
    actualQuarts: number | null;
    oilFilterLabel: string | null;
    ticketId: string;
    technician: string | null;
    disclaimer: string | null;
  };
}

export interface InvoicePayload extends PrintableTicketPayload {
  invoiceNumber: string;
  footer: string | null;
  showRewards: boolean;
  showDisclaimer: boolean;
}

export interface ReceiptPayload extends PrintableTicketPayload {
  receiptNumber: string;
  footer: string | null;
  showVehicle: boolean;
  showRewards: boolean;
}

export function toPrintLineItem(item: TicketItem): PrintLineItem {
  return {
    id: item.id,
    name: item.name,
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unit_price) || 0,
    lineTotal: Number(item.line_total) || 0,
    itemType: item.item_type,
    sku: item.sku,
    productId: item.product_id
  };
}

export function toPrintablePayment(payment: Payment): PrintablePayment {
  return {
    method: payment.method,
    amount: Number(payment.amount) || 0,
    paidAt: payment.paid_at,
    reference: payment.reference
  };
}
