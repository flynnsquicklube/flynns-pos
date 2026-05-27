import { execute, query } from "../../db/sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

export interface VehiclePunchCard {
  id: string;
  customer_id: string;
  vehicle_id: string;
  punch_count: number;
  free_rewards_available: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

export interface PunchResult {
  card: VehiclePunchCard;
  eventId: string;
  earnedFreeOilChange: boolean;
}

export async function getOrCreateVehiclePunchCard(customerId: string, vehicleId: string): Promise<VehiclePunchCard> {
  const existing = await query<VehiclePunchCard>("SELECT * FROM vehicle_punch_cards WHERE customer_id = ? AND vehicle_id = ? LIMIT 1", [customerId, vehicleId]);
  if (existing[0]) return existing[0];
  const id = createId("punch");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO vehicle_punch_cards (id, customer_id, vehicle_id, punch_count, free_rewards_available, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, 0, 0, ?, ?, 'pending')`,
    [id, customerId, vehicleId, timestamp, timestamp]
  );
  const rows = await query<VehiclePunchCard>("SELECT * FROM vehicle_punch_cards WHERE id = ?", [id]);
  if (!rows[0]) throw new Error("Punch card was not created.");
  return rows[0];
}

export async function getVehiclePunchCard(vehicleId: string): Promise<VehiclePunchCard | null> {
  const rows = await query<VehiclePunchCard>("SELECT * FROM vehicle_punch_cards WHERE vehicle_id = ? ORDER BY updated_at DESC LIMIT 1", [vehicleId]);
  return rows[0] ?? null;
}

export async function addOilChangePunch(input: { customerId: string; vehicleId: string; ticketId: string; punchesRequired?: number }): Promise<PunchResult> {
  const punchesRequired = input.punchesRequired ?? 5;
  const card = await getOrCreateVehiclePunchCard(input.customerId, input.vehicleId);
  const beforePunches = card.punch_count;
  const nextRawPunches = beforePunches + 1;
  const earnedRewards = Math.floor(nextRawPunches / punchesRequired);
  const nextPunches = nextRawPunches % punchesRequired;
  const rewardDelta = earnedRewards;
  const eventId = createId("punchevent");
  const timestamp = nowIso();

  await execute(
    `UPDATE vehicle_punch_cards
     SET punch_count = ?, free_rewards_available = free_rewards_available + ?, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    [nextPunches, rewardDelta, timestamp, card.id]
  );
  await execute(
    `INSERT INTO vehicle_punch_events (id, punch_card_id, ticket_id, event_type, punch_delta, reward_delta, note, created_at, sync_status)
     VALUES (?, ?, ?, 'earned', 1, ?, ?, ?, 'pending')`,
    [eventId, card.id, input.ticketId, rewardDelta, rewardDelta > 0 ? "Free oil change reward earned." : "Oil change punch earned.", timestamp]
  );

  const rows = await query<VehiclePunchCard>("SELECT * FROM vehicle_punch_cards WHERE id = ?", [card.id]);
  return { card: rows[0] ?? card, eventId, earnedFreeOilChange: rewardDelta > 0 };
}
