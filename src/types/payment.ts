export type PaymentMethod = "Cash" | "Card" | "Check" | "Other";

export interface Payment {
  id: string;
  ticket_id: string;
  method: PaymentMethod;
  amount: number;
  status: string;
  reference: string | null;
  paid_at: string;
  external_source?: string | null;
  external_id?: string | null;
  is_imported?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
