export interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  vendor: string | null;
  cost: number;
  retail_price: number;
  quantity_on_hand: number;
  reorder_point: number;
  barcode: string | null;
  active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
