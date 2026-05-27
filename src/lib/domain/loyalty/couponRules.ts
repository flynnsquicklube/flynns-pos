import type { TicketItem, TicketWithDetails } from "../../../types/ticket";

export type CouponDiscountType = "fixed" | "percent" | "free_oil_change";
export type CouponStatus = "active" | "redeemed" | "expired" | "canceled";

export interface CustomerCouponRecord {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_amount: number;
  status: CouponStatus;
  source: string | null;
  source_id: string | null;
  issued_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_ticket_id: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isCouponUsable(coupon: CustomerCouponRecord, now = new Date()): string | null {
  if (coupon.status !== "active") return "Coupon is not active.";
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return "Coupon is expired.";
  return null;
}

export function getOilPackageBase(ticket: TicketWithDetails): number {
  const packageLine = ticket.items.find((item) => item.item_type === "package");
  return packageLine ? Math.max(packageLine.line_total, 0) : Math.max(ticket.packageDetails?.package_base_price ?? 0, 0);
}

export function getEligibleSubtotal(ticket: TicketWithDetails): number {
  return roundMoney(ticket.items.reduce((sum, item) => {
    if (item.item_type === "discount" || item.deleted_at) return sum;
    return sum + item.line_total;
  }, 0));
}

export function calculateCouponDiscount(coupon: CustomerCouponRecord, ticket: TicketWithDetails): number {
  const usableError = isCouponUsable(coupon);
  if (usableError) throw new Error(usableError);
  const eligibleSubtotal = getEligibleSubtotal(ticket);
  if (eligibleSubtotal <= 0) return 0;
  if (coupon.discount_type === "fixed") return roundMoney(Math.min(coupon.discount_amount, eligibleSubtotal));
  if (coupon.discount_type === "percent") return roundMoney(Math.min(eligibleSubtotal * (coupon.discount_amount / 100), eligibleSubtotal));
  return roundMoney(Math.min(getOilPackageBase(ticket), eligibleSubtotal));
}

export function couponDiscountLineName(coupon: CustomerCouponRecord): string {
  return coupon.discount_type === "free_oil_change" ? `Reward: ${coupon.title}` : `Coupon: ${coupon.title}`;
}

export function summarizeCoupon(coupon: CustomerCouponRecord): string {
  if (coupon.discount_type === "fixed") return `$${coupon.discount_amount.toFixed(2)} off`;
  if (coupon.discount_type === "percent") return `${coupon.discount_amount}% off`;
  return "Free oil change";
}

export function hasCouponDiscountLine(items: TicketItem[], couponId: string): boolean {
  return items.some((item) => item.item_type === "discount" && item.source_price_type === "coupon" && item.product_id === couponId && !item.deleted_at);
}
