import { calculateTicketTotals } from "../../pricing/pricingEngine";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { execute, query } from "../sqlite";
import { getEffectiveTaxRate } from "../../config/businessProfile";
import { calculateCouponDiscount, couponDiscountLineName, hasCouponDiscountLine, type CouponDiscountType, type CustomerCouponRecord } from "../../domain/loyalty/couponRules";
import { enqueueLoyaltyEvent } from "./loyaltySyncQueueRepo";
import { buildCouponRedeemedPayload } from "../../integrations/loyalty/loyaltyPayloadBuilders";
import type { TicketItem, TicketWithDetails } from "../../../types/ticket";
import type { TicketPackageDetails } from "../../../types/servicePackage";

export interface TicketCouponApplication {
  id: string;
  ticket_id: string;
  coupon_id: string;
  customer_id: string;
  discount_type: CouponDiscountType;
  discount_amount: number;
  calculated_discount: number;
  status: "applied" | "redeemed" | "removed" | "canceled";
  applied_at: string;
  redeemed_at: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

export interface CustomerCouponInput {
  customer_id: string;
  title: string;
  description?: string | null;
  discount_type: CouponDiscountType;
  discount_amount: number;
  source?: string | null;
  source_id?: string | null;
  expires_at?: string | null;
}

async function taxRate(): Promise<number> {
  return await getEffectiveTaxRate();
}

async function recalculateTicket(ticketId: string): Promise<void> {
  const rows = await query<{
    service_id: string | null;
    item_type: "service" | "package" | "fee" | "discount" | "custom" | "inventory";
    package_id: string | null;
    inventory_item_id: string | null;
    name: string;
    quantity: number;
    unit_price: number;
    taxable: number;
  }>("SELECT service_id, item_type, package_id, inventory_item_id, name, quantity, unit_price, taxable FROM ticket_items WHERE ticket_id = ? AND deleted_at IS NULL", [ticketId]);
  const totals = calculateTicketTotals(rows, [], { taxRate: await taxRate() });
  const activeCouponRows = await query<{ coupon_id: string }>("SELECT coupon_id FROM ticket_coupon_applications WHERE ticket_id = ? AND status = 'applied'", [ticketId]);
  await execute(
    "UPDATE tickets SET subtotal = ?, discount_total = ?, taxable_subtotal = ?, tax_rate = ?, tax_total = ?, fee_total = ?, total = ?, amount_due = ?, applied_coupon_ids = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [totals.subtotal, totals.discountTotal, totals.taxableSubtotal, totals.taxRate, totals.taxTotal, totals.feeTotal, totals.total, totals.amountDue, activeCouponRows.map((row) => row.coupon_id).join(",") || null, nowIso(), ticketId]
  );
}

async function getTicketForCoupons(ticketId: string): Promise<TicketWithDetails | null> {
  const rows = await query<TicketWithDetails>(
    `SELECT
      t.*,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      v.year AS vehicle_year,
      v.make AS vehicle_make,
      v.model AS vehicle_model,
      v.mileage AS vehicle_mileage,
      v.oil_type AS vehicle_oil_type,
      v.plate AS vehicle_plate,
      v.vin AS vehicle_vin,
      v.plate_state AS vehicle_plate_state,
      (SELECT GROUP_CONCAT(name, ', ') FROM ticket_items WHERE ticket_id = t.id AND deleted_at IS NULL) AS service_names
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     WHERE t.id = ? AND t.deleted_at IS NULL`,
    [ticketId]
  );
  const ticket = rows[0];
  if (!ticket) return null;
  const items = await query<TicketItem>("SELECT * FROM ticket_items WHERE ticket_id = ? AND deleted_at IS NULL ORDER BY created_at ASC", [ticketId]);
  const packageDetails = (await query<TicketPackageDetails>("SELECT * FROM ticket_package_details WHERE ticket_id = ? AND deleted_at IS NULL LIMIT 1", [ticketId]))[0] ?? null;
  return { ...ticket, items, packageDetails };
}

export function listActiveCouponsByCustomer(customerId: string): Promise<CustomerCouponRecord[]> {
  return query<CustomerCouponRecord>(
    "SELECT * FROM customer_coupons WHERE customer_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at >= ?) ORDER BY issued_at DESC",
    [customerId, nowIso()]
  );
}

export function listCouponsByCustomer(customerId: string): Promise<CustomerCouponRecord[]> {
  return query<CustomerCouponRecord>("SELECT * FROM customer_coupons WHERE customer_id = ? ORDER BY issued_at DESC", [customerId]);
}

export async function createCustomerCoupon(input: CustomerCouponInput): Promise<CustomerCouponRecord> {
  const id = createId("coupon");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO customer_coupons (
      id, customer_id, title, description, discount_type, discount_amount, status, source, source_id,
      issued_at, expires_at, redeemed_at, redeemed_ticket_id, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL, ?, ?, 'pending')`,
    [id, input.customer_id, input.title, input.description ?? null, input.discount_type, input.discount_amount, input.source ?? "manual", input.source_id ?? null, timestamp, input.expires_at ?? null, timestamp, timestamp]
  );
  const rows = await query<CustomerCouponRecord>("SELECT * FROM customer_coupons WHERE id = ?", [id]);
  if (!rows[0]) throw new Error("Coupon was not created.");
  return rows[0];
}

export async function getTicketCouponApplications(ticketId: string): Promise<TicketCouponApplication[]> {
  return query<TicketCouponApplication>("SELECT * FROM ticket_coupon_applications WHERE ticket_id = ? ORDER BY applied_at DESC", [ticketId]);
}

export async function applyCouponToTicket(ticketId: string, couponId: string): Promise<void> {
  const ticket = await getTicketForCoupons(ticketId);
  if (!ticket || !ticket.customer_id) throw new Error("Ticket not found.");
  if (ticket.status === "completed" || ticket.status === "canceled") throw new Error("Coupons cannot be applied to completed or canceled tickets.");
  const coupon = (await query<CustomerCouponRecord>("SELECT * FROM customer_coupons WHERE id = ? AND customer_id = ?", [couponId, ticket.customer_id]))[0];
  if (!coupon) throw new Error("Coupon not found for this customer.");
  const existing = await query<TicketCouponApplication>("SELECT * FROM ticket_coupon_applications WHERE ticket_id = ? AND coupon_id = ? AND status = 'applied'", [ticketId, couponId]);
  if (existing[0] || hasCouponDiscountLine(ticket.items, couponId)) throw new Error("Coupon is already applied.");
  const discount = calculateCouponDiscount(coupon, ticket);
  if (discount <= 0) throw new Error("Coupon has no eligible discount for this ticket.");
  const timestamp = nowIso();
  const applicationId = createId("couponapp");
  await execute(
    `INSERT INTO ticket_coupon_applications (
      id, ticket_id, coupon_id, customer_id, discount_type, discount_amount, calculated_discount,
      status, applied_at, redeemed_at, removed_at, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'applied', ?, NULL, NULL, ?, ?, 'pending')`,
    [applicationId, ticketId, coupon.id, ticket.customer_id, coupon.discount_type, coupon.discount_amount, discount, timestamp, timestamp, timestamp]
  );
  await execute(
    `INSERT INTO ticket_items (
      id, ticket_id, service_id, item_type, package_id, inventory_item_id, cost, sku, product_id, source_price_type,
      name, quantity, unit_price, line_total, taxable, created_at, updated_at, deleted_at, sync_status
    ) VALUES (?, ?, NULL, 'discount', NULL, NULL, NULL, NULL, ?, 'coupon', ?, 1, ?, ?, 0, ?, ?, NULL, 'pending')`,
    [createId("item"), ticketId, coupon.id, couponDiscountLineName(coupon), discount, discount, timestamp, timestamp]
  );
  if (coupon.discount_type === "free_oil_change") {
    await execute("UPDATE tickets SET free_oil_change_redeemed = 1 WHERE id = ?", [ticketId]);
  }
  await recalculateTicket(ticketId);
}

export async function removeCouponFromTicket(ticketId: string, couponId: string): Promise<void> {
  const timestamp = nowIso();
  await execute("UPDATE ticket_coupon_applications SET status = 'removed', removed_at = ?, updated_at = ?, sync_status = 'pending' WHERE ticket_id = ? AND coupon_id = ? AND status = 'applied'", [timestamp, timestamp, ticketId, couponId]);
  await execute("UPDATE ticket_items SET deleted_at = ?, updated_at = ?, sync_status = 'pending' WHERE ticket_id = ? AND product_id = ? AND source_price_type = 'coupon' AND deleted_at IS NULL", [timestamp, timestamp, ticketId, couponId]);
  const remainingFree = await query<{ count: number }>("SELECT COUNT(*) AS count FROM ticket_coupon_applications WHERE ticket_id = ? AND status = 'applied' AND discount_type = 'free_oil_change'", [ticketId]);
  if ((remainingFree[0]?.count ?? 0) === 0) await execute("UPDATE tickets SET free_oil_change_redeemed = 0 WHERE id = ?", [ticketId]);
  await recalculateTicket(ticketId);
}

export async function markCouponRedeemed(couponId: string, ticketId: string): Promise<void> {
  const timestamp = nowIso();
  await execute("UPDATE customer_coupons SET status = 'redeemed', redeemed_at = ?, redeemed_ticket_id = ?, updated_at = ?, sync_status = 'pending' WHERE id = ? AND status = 'active'", [timestamp, ticketId, timestamp, couponId]);
}

export async function redeemAppliedCoupons(ticketId: string): Promise<TicketCouponApplication[]> {
  const ticket = await getTicketForCoupons(ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  const applications = await query<TicketCouponApplication>("SELECT * FROM ticket_coupon_applications WHERE ticket_id = ? AND status = 'applied'", [ticketId]);
  const timestamp = nowIso();
  for (const application of applications) {
    await markCouponRedeemed(application.coupon_id, ticketId);
    await execute("UPDATE ticket_coupon_applications SET status = 'redeemed', redeemed_at = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [timestamp, timestamp, application.id]);
    const coupon = (await query<CustomerCouponRecord>("SELECT * FROM customer_coupons WHERE id = ?", [application.coupon_id]))[0];
    if (coupon) {
      enqueueLoyaltyEvent({
        event_type: "coupon_redeemed",
        entity_type: "coupon",
        entity_id: coupon.id,
        payload: buildCouponRedeemedPayload(ticket, coupon as unknown as Record<string, unknown>, coupon.id)
      }).catch((error: unknown) => console.warn("[coupon-sync-queue]", error));
    }
  }
  return applications;
}
