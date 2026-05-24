import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import type { ServiceHistory } from "../../../types/serviceHistory";

export interface ServiceHistoryInput {
  ticket_id: string;
  customer_id: string;
  vehicle_id: string;
  service_date: string;
  mileage: number;
  oil_type: string | null;
  services_json: string;
  notes: string | null;
}

export async function createServiceHistory(input: ServiceHistoryInput): Promise<ServiceHistory> {
  const id = createId("hist");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO service_history (
      id, ticket_id, customer_id, vehicle_id, service_date, mileage, oil_type,
      services_json, notes, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, input.ticket_id, input.customer_id, input.vehicle_id, input.service_date, input.mileage, input.oil_type, input.services_json, input.notes, timestamp, timestamp]
  );
  const rows = await query<ServiceHistory>("SELECT * FROM service_history WHERE id = ?", [id]);
  const history = rows[0];
  if (!history) throw new Error("Service history was not created.");
  return history;
}

export async function getServiceHistoryByVehicle(vehicleId: string): Promise<ServiceHistory[]> {
  return query<ServiceHistory>("SELECT * FROM service_history WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY service_date DESC", [vehicleId]);
}

export async function getServiceHistoryByCustomer(customerId: string): Promise<ServiceHistory[]> {
  return query<ServiceHistory>("SELECT * FROM service_history WHERE customer_id = ? AND deleted_at IS NULL ORDER BY service_date DESC", [customerId]);
}

export async function listServiceHistory(filters: { vehicleId?: string; customerId?: string } = {}): Promise<ServiceHistory[]> {
  const clauses = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (filters.vehicleId) {
    clauses.push("vehicle_id = ?");
    params.push(filters.vehicleId);
  }
  if (filters.customerId) {
    clauses.push("customer_id = ?");
    params.push(filters.customerId);
  }
  return query<ServiceHistory>(`SELECT * FROM service_history WHERE ${clauses.join(" AND ")} ORDER BY service_date DESC`, params);
}
