export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  firebase_uid: string | null;
  app_email?: string | null;
  app_phone?: string | null;
  app_link_status?: "unlinked" | "matched" | "linked" | "conflict" | null;
  app_linked_at?: string | null;
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
