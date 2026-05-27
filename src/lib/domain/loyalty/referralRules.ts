import { execute, query } from "../../db/sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

export interface ReferralReward {
  id: string;
  referrer_customer_id: string;
  referred_customer_id: string;
  referred_ticket_id: string | null;
  status: "pending" | "completed" | "rewarded" | "canceled";
  reward_amount: number;
  completed_at: string | null;
  rewarded_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

export interface CustomerCoupon {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  discount_type: "fixed" | "percent" | "free_oil_change";
  discount_amount: number;
  status: "active" | "redeemed" | "expired" | "canceled";
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

export interface ReferralRewardResult {
  referral: ReferralReward;
  coupons: CustomerCoupon[];
}

async function createReferralCoupon(customerId: string, referralId: string, amount: number, label: string): Promise<CustomerCoupon> {
  const id = createId("coupon");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO customer_coupons (
      id, customer_id, title, description, discount_type, discount_amount, status,
      source, source_id, issued_at, expires_at, redeemed_at, redeemed_ticket_id, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, 'fixed', ?, 'active', 'referral', ?, ?, NULL, NULL, NULL, ?, ?, 'pending')`,
    [id, customerId, "$10 Referral Reward", label, amount, referralId, timestamp, timestamp, timestamp]
  );
  const rows = await query<CustomerCoupon>("SELECT * FROM customer_coupons WHERE id = ?", [id]);
  if (!rows[0]) throw new Error("Referral coupon was not created.");
  return rows[0];
}

export async function completePendingReferralRewards(referredCustomerId: string, ticketId: string): Promise<ReferralRewardResult[]> {
  const pending = await query<ReferralReward>(
    "SELECT * FROM referral_rewards WHERE referred_customer_id = ? AND status = 'pending'",
    [referredCustomerId]
  );
  const results: ReferralRewardResult[] = [];
  for (const referral of pending) {
    const timestamp = nowIso();
    await execute(
      `UPDATE referral_rewards
       SET status = 'rewarded', referred_ticket_id = ?, completed_at = ?, rewarded_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [ticketId, timestamp, timestamp, timestamp, referral.id]
    );
    const updatedRows = await query<ReferralReward>("SELECT * FROM referral_rewards WHERE id = ?", [referral.id]);
    const updated = updatedRows[0] ?? { ...referral, status: "rewarded" as const, referred_ticket_id: ticketId, completed_at: timestamp, rewarded_at: timestamp, updated_at: timestamp };
    const coupons = [
      await createReferralCoupon(referral.referrer_customer_id, referral.id, referral.reward_amount, "Thanks for referring a new customer."),
      await createReferralCoupon(referral.referred_customer_id, referral.id, referral.reward_amount, "Thanks for completing your first referred visit.")
    ];
    results.push({ referral: updated, coupons });
  }
  return results;
}
