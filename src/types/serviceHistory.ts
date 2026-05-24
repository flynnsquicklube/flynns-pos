export interface ServiceHistory {
  id: string;
  ticket_id: string;
  customer_id: string;
  vehicle_id: string;
  service_date: string;
  mileage: number;
  oil_type: string | null;
  services_json: string;
  notes: string | null;
  external_source?: string | null;
  external_id?: string | null;
  is_imported?: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
