export interface ServiceCatalogItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  sku: string | null;
  base_price: number;
  cost: number | null;
  taxable: number;
  active: number;
  is_oil_change: number;
  is_fee: number;
  is_discount: number;
  inventory_item_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export interface ServiceCatalogItemInput {
  name: string;
  category: string;
  description?: string | null;
  sku?: string | null;
  base_price: number;
  cost?: number | null;
  taxable?: number;
  active?: number;
  is_oil_change?: number;
  is_fee?: number;
  is_discount?: number;
  inventory_item_id?: string | null;
  sort_order?: number;
}
