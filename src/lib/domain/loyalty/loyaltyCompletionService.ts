import { getCustomer } from "../../db/repositories/customersRepo";
import { enqueueLoyaltyEvent } from "../../db/repositories/loyaltySyncQueueRepo";
import { getVehicle } from "../../db/repositories/vehiclesRepo";
import { buildCheckInCompletedPayload, buildCompletedServicePayload, buildCouponAssignedPayload, buildCustomerPayload, buildFreeOilChangeEarnedPayload, buildFreeOilChangeRedeemedPayload, buildPunchAddedPayload, buildReferralCompletedPayload, buildReferralCouponIssuedPayload, buildVehiclePayload } from "../../integrations/loyalty/loyaltyPayloadBuilders";
import type { ServiceHistory } from "../../../types/serviceHistory";
import type { TicketWithDetails } from "../../../types/ticket";
import { addOilChangePunch } from "./punchCardRules";
import { completePendingReferralRewards } from "./referralRules";

function isOilChange(ticket: TicketWithDetails): boolean {
  const text = [
    ticket.packageDetails?.package_name,
    ticket.packageDetails?.oil_type,
    ticket.service_names,
    ...ticket.items.map((item) => item.name)
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes("oil") || Boolean(ticket.packageDetails);
}

export async function enqueueCompletedTicketLoyaltyEvents(ticket: TicketWithDetails, serviceHistory: ServiceHistory): Promise<void> {
  if (!ticket.customer_id || !ticket.vehicle_id) return;
  const [customer, vehicle] = await Promise.all([getCustomer(ticket.customer_id), getVehicle(ticket.vehicle_id)]);
  if (!customer || !vehicle) return;

  await enqueueLoyaltyEvent({
    event_type: "customer_upsert",
    entity_type: "customer",
    entity_id: customer.id,
    payload: buildCustomerPayload(customer, "pending")
  });
  await enqueueLoyaltyEvent({
    event_type: "vehicle_upsert",
    entity_type: "vehicle",
    entity_id: vehicle.id,
    payload: buildVehiclePayload(vehicle, customer, "pending")
  });
  await enqueueLoyaltyEvent({
    event_type: "completed_service",
    entity_type: "service_history",
    entity_id: serviceHistory.id,
    payload: buildCompletedServicePayload(ticket, serviceHistory, vehicle, customer, ticket.packageDetails ?? null, ticket.items, "pending")
  });

  if (isOilChange(ticket)) {
    const punch = await addOilChangePunch({ customerId: customer.id, vehicleId: vehicle.id, ticketId: ticket.id });
    await enqueueLoyaltyEvent({
      event_type: "punch_added",
      entity_type: "vehicle",
      entity_id: vehicle.id,
      payload: buildPunchAddedPayload(ticket, vehicle, customer, punch.card.punch_count, punch.card.free_rewards_available, punch.eventId)
    });
    if (punch.earnedFreeOilChange) {
      await enqueueLoyaltyEvent({
        event_type: "free_oil_change_earned",
        entity_type: "vehicle",
        entity_id: vehicle.id,
        payload: buildFreeOilChangeEarnedPayload(vehicle, customer, punch.card.free_rewards_available, punch.eventId)
      });
    }
  }

  if (ticket.free_oil_change_redeemed) {
    await enqueueLoyaltyEvent({
      event_type: "free_oil_change_redeemed",
      entity_type: "vehicle",
      entity_id: vehicle.id,
      payload: buildFreeOilChangeRedeemedPayload(ticket, vehicle, customer, ticket.id)
    });
  }

  const referralResults = await completePendingReferralRewards(customer.id, ticket.id);
  for (const result of referralResults) {
    await enqueueLoyaltyEvent({
      event_type: "referral_completed",
      entity_type: "referral",
      entity_id: result.referral.id,
      payload: buildReferralCompletedPayload(result.referral as unknown as Record<string, unknown>, ticket, result.referral.id)
    });
    for (const coupon of result.coupons) {
      const couponCustomer = coupon.customer_id === customer.id ? customer : await getCustomer(coupon.customer_id);
      if (!couponCustomer) continue;
      await enqueueLoyaltyEvent({
        event_type: "referral_coupon_issued",
        entity_type: "coupon",
        entity_id: coupon.id,
        payload: buildReferralCouponIssuedPayload(couponCustomer, result.referral as unknown as Record<string, unknown>, coupon.discount_amount, coupon.id)
      });
      await enqueueLoyaltyEvent({
        event_type: "coupon_assigned",
        entity_type: "coupon",
        entity_id: coupon.id,
        payload: buildCouponAssignedPayload(couponCustomer, coupon as unknown as Record<string, unknown>, coupon.id)
      });
    }
  }

  if (ticket.check_in_id) {
    await enqueueLoyaltyEvent({
      event_type: "check_in_completed",
      entity_type: "check_in",
      entity_id: ticket.check_in_id,
      payload: buildCheckInCompletedPayload(ticket, { id: ticket.check_in_id }, ticket.check_in_id)
    });
  }
}
