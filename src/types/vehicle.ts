export interface Vehicle {
  id: string;
  customer_id: string;
  vin: string | null;
  plate: string | null;
  plate_state: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  oil_type: string | null;
  oil_capacity?: number | null;
  oil_filter_sku?: string | null;
  oil_filter_inventory_item_id?: string | null;
  last_oil_change_date?: string | null;
  last_oil_change_mileage?: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export type VehicleInput = Omit<Vehicle, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;
