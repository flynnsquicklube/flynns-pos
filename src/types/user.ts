export interface User {
  id: string;
  name: string;
  role: string;
  pin_hash: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
