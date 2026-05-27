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

export async function serviceHistoryExistsForTicket(ticketId: string): Promise<boolean> {
  const [row] = await query<{ count: number }>(
    "SELECT COUNT(*) AS count FROM service_history WHERE ticket_id = ? AND deleted_at IS NULL",
    [ticketId]
  );
  return (row?.count ?? 0) > 0;
}

export async function getServiceHistoryByTicket(ticketId: string): Promise<ServiceHistory | null> {
  const rows = await query<ServiceHistory>("SELECT * FROM service_history WHERE ticket_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1", [ticketId]);
  return rows[0] ?? null;
}

export async function getServiceHistoryByVehicle(vehicleId: string): Promise<ServiceHistory[]> {
  return query<ServiceHistory>("SELECT * FROM service_history WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY service_date DESC", [vehicleId]);
}

export async function getOilChangeHistoryByVehicle(vehicleId: string, limit = 10): Promise<ServiceHistory[]> {
  return query<ServiceHistory>(
    `SELECT * FROM service_history
     WHERE vehicle_id = ?
       AND deleted_at IS NULL
       AND LOWER(COALESCE(services_json, '') || ' ' || COALESCE(oil_type, '') || ' ' || COALESCE(notes, '')) LIKE '%oil%'
     ORDER BY service_date DESC
     LIMIT ?`,
    [vehicleId, limit]
  );
}

export interface LastOilFilterHistory {
  inventoryItemId: string | null;
  sku: string | null;
  name: string | null;
  sourceText: string | null;
}

export async function getLastOilFilterForVehicle(vehicleId: string): Promise<LastOilFilterHistory | null> {
  const rows = await query<{ services_json: string }>(
    `SELECT services_json
     FROM service_history
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY service_date DESC
     LIMIT 10`,
    [vehicleId]
  );
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.services_json) as unknown;
      const packageDetails = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).packageDetails as Record<string, unknown> | null : null;
      if (packageDetails?.oil_filter_sku || packageDetails?.oil_filter_name || packageDetails?.oil_filter_inventory_item_id) {
        return {
          inventoryItemId: typeof packageDetails.oil_filter_inventory_item_id === "string" ? packageDetails.oil_filter_inventory_item_id : null,
          sku: typeof packageDetails.oil_filter_sku === "string" ? packageDetails.oil_filter_sku : null,
          name: typeof packageDetails.oil_filter_name === "string" ? packageDetails.oil_filter_name : null,
          sourceText: JSON.stringify(packageDetails)
        };
      }
      const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? ((parsed as Record<string, unknown>).items as unknown[]) ?? [] : [];
      const match = items.find((item) => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        const text = `${String(candidate.name ?? "")} ${String(candidate.sku ?? "")} ${String(candidate.product_id ?? "")}`.toLowerCase();
        return text.includes("filter") && (/\bof[\s-]?[a-z0-9]{2,8}\b/i.test(text) || Boolean(candidate.inventory_item_id) || Boolean(candidate.sku) || Boolean(candidate.product_id));
      }) as Record<string, unknown> | undefined;
      if (match) {
        return {
          inventoryItemId: typeof match.inventory_item_id === "string" ? match.inventory_item_id : null,
          sku: typeof match.sku === "string" ? match.sku : typeof match.product_id === "string" ? match.product_id : null,
          name: typeof match.name === "string" ? match.name : null,
          sourceText: JSON.stringify(match)
        };
      }
    } catch {
      if (row.services_json.toLowerCase().includes("filter")) {
        return { inventoryItemId: null, sku: null, name: "Oil filter", sourceText: row.services_json };
      }
    }
  }
  return null;
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
