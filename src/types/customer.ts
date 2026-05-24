export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  firebase_uid: string | null;
  referral_code: string | null;
  external_source?: string | null;
  external_id?: string | null;
  is_imported?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export type CustomerInput = Omit<Customer, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;
