export interface Service {
  id: string;
  name: string;
  category: string;
  description: string | null;
  base_price: number;
  taxable: number;
  active: number;
  is_oil_change: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
