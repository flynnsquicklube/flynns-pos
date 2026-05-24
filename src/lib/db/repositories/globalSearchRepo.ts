import { looksLikeVin } from "../../domain/search/globalSearch";
import { normalizePhone } from "../../utils/phone";
import { query } from "../sqlite";

export interface GlobalSearchOptions {
  customerLimit?: number;
  vehicleLimit?: number;
  ticketLimit?: number;
}

export interface GlobalCustomerResult {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  is_imported: number;
  vehicle_count: number;
}

export interface GlobalVehicleResult {
  id: string;
  customer_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  plate: string | null;
  plate_state: string | null;
  mileage: number | null;
  customer_name: string | null;
}

export interface GlobalTicketResult {
  id: string;
  external_id: string | null;
  created_at: string;
  completed_at: string | null;
  status: string;
  payment_status: string;
  total: number;
  customer_name: string | null;
  vehicle_label: string | null;
  vehicle_plate: string | null;
  vehicle_vin: string | null;
}

export interface GlobalSearchResults {
  customers: GlobalCustomerResult[];
  vehicles: GlobalVehicleResult[];
  tickets: GlobalTicketResult[];
}

function phoneSql(column: string) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, '-', ''), '(', ''), ')', ''), ' ', ''), '.', '')`;
}

export async function globalSearch(searchQuery: string, options: GlobalSearchOptions = {}): Promise<GlobalSearchResults> {
  const trimmed = searchQuery.trim();
  const like = `%${trimmed}%`;
  const phoneDigits = normalizePhone(trimmed);
  const phoneLike = `%${phoneDigits}%`;
  const vinExact = looksLikeVin(trimmed) ? trimmed.toUpperCase() : null;
  const customerLimit = options.customerLimit ?? 10;
  const vehicleLimit = options.vehicleLimit ?? 10;
  const ticketLimit = options.ticketLimit ?? 5;

  const customers = await query<GlobalCustomerResult>(
    `SELECT c.id, c.first_name, c.last_name, c.phone, c.email, COALESCE(c.is_imported, 0) AS is_imported,
      (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id AND v.deleted_at IS NULL) AS vehicle_count
     FROM customers c
     WHERE c.deleted_at IS NULL
       AND (
        c.first_name LIKE ?
        OR c.last_name LIKE ?
        OR (c.first_name || ' ' || c.last_name) LIKE ?
        OR c.email LIKE ?
        OR c.phone LIKE ?
        OR (? != '' AND ${phoneSql("c.phone")} LIKE ?)
        OR EXISTS (
          SELECT 1 FROM vehicles v
          WHERE v.customer_id = c.id
            AND v.deleted_at IS NULL
            AND (v.vin LIKE ? OR v.plate LIKE ? OR CAST(v.year AS TEXT) LIKE ? OR v.make LIKE ? OR v.model LIKE ?)
        )
       )
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    [like, like, like, like, like, phoneDigits, phoneLike, like, like, like, like, like, customerLimit]
  );

  const vehicles = await query<GlobalVehicleResult>(
    `SELECT v.id, v.customer_id, v.year, v.make, v.model, v.vin, v.plate, v.plate_state, v.mileage,
      (c.first_name || ' ' || c.last_name) AS customer_name
     FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id
     WHERE v.deleted_at IS NULL
       AND (
        (? IS NOT NULL AND UPPER(v.vin) = ?)
        OR v.vin LIKE ?
        OR v.plate LIKE ?
        OR CAST(v.year AS TEXT) LIKE ?
        OR v.make LIKE ?
        OR v.model LIKE ?
        OR c.first_name LIKE ?
        OR c.last_name LIKE ?
        OR (c.first_name || ' ' || c.last_name) LIKE ?
        OR (? != '' AND ${phoneSql("c.phone")} LIKE ?)
       )
     ORDER BY CASE WHEN ? IS NOT NULL AND UPPER(v.vin) = ? THEN 0 ELSE 1 END, v.updated_at DESC
     LIMIT ?`,
    [vinExact, vinExact, like, like, like, like, like, like, like, like, phoneDigits, phoneLike, vinExact, vinExact, vehicleLimit]
  );

  const tickets = await query<GlobalTicketResult>(
    `SELECT t.id, t.external_id, t.created_at, t.completed_at, t.status, t.payment_status, t.total,
      (c.first_name || ' ' || c.last_name) AS customer_name,
      TRIM(COALESCE(v.year, '') || ' ' || COALESCE(v.make, '') || ' ' || COALESCE(v.model, '')) AS vehicle_label,
      v.plate AS vehicle_plate,
      v.vin AS vehicle_vin
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.deleted_at IS NULL
       AND (
        t.id LIKE ?
        OR t.external_id LIKE ?
        OR c.first_name LIKE ?
        OR c.last_name LIKE ?
        OR (c.first_name || ' ' || c.last_name) LIKE ?
        OR v.vin LIKE ?
        OR v.plate LIKE ?
        OR CAST(v.year AS TEXT) LIKE ?
        OR v.make LIKE ?
        OR v.model LIKE ?
        OR (? != '' AND ${phoneSql("c.phone")} LIKE ?)
       )
     ORDER BY COALESCE(t.completed_at, t.created_at) DESC
     LIMIT ?`,
    [like, like, like, like, like, like, like, like, like, like, phoneDigits, phoneLike, ticketLimit]
  );

  return { customers, vehicles, tickets };
}

