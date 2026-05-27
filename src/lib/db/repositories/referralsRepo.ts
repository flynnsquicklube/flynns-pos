import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { completePendingReferralRewards, type ReferralReward, type ReferralRewardResult } from "../../domain/loyalty/referralRules";

export interface ReferralRewardInput {
  referrer_customer_id: string;
  referred_customer_id: string;
  reward_amount?: number;
}

export async function createReferralReward(input: ReferralRewardInput): Promise<ReferralReward> {
  const id = createId("referral");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO referral_rewards (
      id, referrer_customer_id, referred_customer_id, referred_ticket_id, status, reward_amount,
      completed_at, rewarded_at, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, NULL, 'pending', ?, NULL, NULL, ?, ?, 'pending')`,
    [id, input.referrer_customer_id, input.referred_customer_id, input.reward_amount ?? 10, timestamp, timestamp]
  );
  const rows = await query<ReferralReward>("SELECT * FROM referral_rewards WHERE id = ?", [id]);
  if (!rows[0]) throw new Error("Referral reward was not created.");
  return rows[0];
}

export async function findPendingReferralForReferredCustomer(customerId: string): Promise<ReferralReward | null> {
  const rows = await query<ReferralReward>("SELECT * FROM referral_rewards WHERE referred_customer_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1", [customerId]);
  return rows[0] ?? null;
}

export function completeReferralReward(referredCustomerId: string, ticketId: string): Promise<ReferralRewardResult[]> {
  return completePendingReferralRewards(referredCustomerId, ticketId);
}

export async function issueReferralCoupons(referralRewardId: string): Promise<ReferralReward | null> {
  const rows = await query<ReferralReward>("SELECT * FROM referral_rewards WHERE id = ?", [referralRewardId]);
  return rows[0] ?? null;
}

export async function listReferralRewardsByCustomer(customerId: string): Promise<ReferralReward[]> {
  return query<ReferralReward>(
    `SELECT * FROM referral_rewards
     WHERE referrer_customer_id = ? OR referred_customer_id = ?
     ORDER BY created_at DESC`,
    [customerId, customerId]
  );
}
