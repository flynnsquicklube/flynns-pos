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
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}

export type VehicleInput = Omit<Vehicle, "id" | "created_at" | "updated_at" | "deleted_at" | "sync_status">;
