import type { TicketPackageDetails } from "./servicePackage";

export type TicketStatus = "draft" | "checked_in" | "in_service" | "waiting_payment" | "completed" | "canceled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export interface Ticket {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  status: TicketStatus;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  fee_total: number;
  total: number;
  payment_status: PaymentStatus;
  notes: string | null;
  customer_concern: string | null;
  technician_notes: string | null;
  internal_notes: string | null;
  bay: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  sync_status: string;
}

export interface TicketItem {
  id: string;
  ticket_id: string;
  service_id: string | null;
  item_type: string | null;
  package_id: string | null;
  inventory_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  taxable: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface TicketWithDetails extends Ticket {
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_mileage: number | null;
  vehicle_oil_type: string | null;
  vehicle_plate: string | null;
  vehicle_vin: string | null;
  vehicle_plate_state: string | null;
  service_names: string | null;
  items: TicketItem[];
  packageDetails?: TicketPackageDetails | null;
}

export interface TicketLineInput {
  service_id: string | null;
  item_type?: "service" | "package" | "fee" | "discount" | "custom" | "inventory";
  package_id?: string | null;
  inventory_item_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  taxable: number;
}
