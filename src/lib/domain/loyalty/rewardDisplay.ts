import type { CustomerCouponRecord } from "./couponRules";
import type { VehiclePunchCard } from "./punchCardRules";

export function formatPunchProgress(card: VehiclePunchCard | null, punchesRequired = 5): string {
  if (!card) return `0/${punchesRequired} punches`;
  return `${card.punch_count}/${punchesRequired} punches`;
}

export function getRewardSummary(input: { coupons: CustomerCouponRecord[]; punchCard: VehiclePunchCard | null; punchesRequired?: number }): string {
  const punchesRequired = input.punchesRequired ?? 5;
  const activeCoupons = input.coupons.filter((coupon) => coupon.status === "active").length;
  const rewards = input.punchCard?.free_rewards_available ?? 0;
  return `${formatPunchProgress(input.punchCard, punchesRequired)} · ${rewards} reward${rewards === 1 ? "" : "s"} available · ${activeCoupons} active coupon${activeCoupons === 1 ? "" : "s"}`;
}
