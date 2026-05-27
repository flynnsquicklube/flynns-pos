import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";
import { addOilChangePunch, getOrCreateVehiclePunchCard, getVehiclePunchCard, type PunchResult, type VehiclePunchCard } from "../../domain/loyalty/punchCardRules";
import { createCustomerCoupon } from "./couponsRepo";

export interface VehiclePunchEvent {
  id: string;
  punch_card_id: string;
  ticket_id: string | null;
  event_type: "earned" | "redeemed" | "adjusted";
  punch_delta: number;
  reward_delta: number;
  note: string | null;
  created_at: string;
  sync_status: string;
}

export type { VehiclePunchCard };
export { getOrCreateVehiclePunchCard, getVehiclePunchCard };

export function getPunchCardByVehicle(vehicleId: string): Promise<VehiclePunchCard | null> {
  return getVehiclePunchCard(vehicleId);
}

export function addPunchForOilChange(ticketId: string, customerId: string, vehicleId: string): Promise<PunchResult> {
  return addOilChangePunch({ ticketId, customerId, vehicleId });
}

export async function redeemFreeOilChange(ticketId: string, customerId: string, vehicleId: string): Promise<VehiclePunchEvent> {
  const card = await getOrCreateVehiclePunchCard(customerId, vehicleId);
  if (card.free_rewards_available <= 0) throw new Error("No free oil change reward is available for this vehicle.");
  const eventId = createId("punchevent");
  const timestamp = nowIso();
  await execute(
    "UPDATE vehicle_punch_cards SET free_rewards_available = free_rewards_available - 1, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [timestamp, card.id]
  );
  await execute(
    `INSERT INTO vehicle_punch_events (id, punch_card_id, ticket_id, event_type, punch_delta, reward_delta, note, created_at, sync_status)
     VALUES (?, ?, ?, 'redeemed', 0, -1, 'Free oil change reward redeemed.', ?, 'pending')`,
    [eventId, card.id, ticketId, timestamp]
  );
  const rows = await query<VehiclePunchEvent>("SELECT * FROM vehicle_punch_events WHERE id = ?", [eventId]);
  return rows[0];
}

export async function adjustPunchCard(input: { customerId: string; vehicleId: string; punchDelta: number; rewardDelta?: number; note?: string | null }): Promise<VehiclePunchEvent> {
  const card = await getOrCreateVehiclePunchCard(input.customerId, input.vehicleId);
  const eventId = createId("punchevent");
  const timestamp = nowIso();
  await execute(
    `UPDATE vehicle_punch_cards
     SET punch_count = MAX(0, punch_count + ?), free_rewards_available = MAX(0, free_rewards_available + ?), updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [input.punchDelta, input.rewardDelta ?? 0, timestamp, card.id]
  );
  await execute(
    `INSERT INTO vehicle_punch_events (id, punch_card_id, ticket_id, event_type, punch_delta, reward_delta, note, created_at, sync_status)
     VALUES (?, ?, NULL, 'adjusted', ?, ?, ?, ?, 'pending')`,
    [eventId, card.id, input.punchDelta, input.rewardDelta ?? 0, input.note ?? null, timestamp]
  );
  const rows = await query<VehiclePunchEvent>("SELECT * FROM vehicle_punch_events WHERE id = ?", [eventId]);
  return rows[0];
}

export async function createFreeOilChangeCoupon(customerId: string, punchCardId: string) {
  return createCustomerCoupon({
    customer_id: customerId,
    title: "Free Oil Change Reward",
    description: "Vehicle punch card reward.",
    discount_type: "free_oil_change",
    discount_amount: 0,
    source: "punch_reward",
    source_id: punchCardId
  });
}

export async function listPunchEvents(vehicleId: string): Promise<VehiclePunchEvent[]> {
  const card = await getVehiclePunchCard(vehicleId);
  if (!card) return [];
  return query<VehiclePunchEvent>("SELECT * FROM vehicle_punch_events WHERE punch_card_id = ? ORDER BY created_at DESC", [card.id]);
}
