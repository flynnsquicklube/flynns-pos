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
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
}
