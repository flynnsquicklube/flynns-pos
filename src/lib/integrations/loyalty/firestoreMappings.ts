import type { LoyaltySyncQueueEvent } from "./loyaltySync.types";

export interface FirestoreCollectionNames {
  users: string;
  vehicles: string;
  checkIns: string;
  serviceHistory: string;
  userCoupons: string;
  referrals: string;
  punchCards: string;
  redemptions: string;
}

export const defaultFirestoreCollections: FirestoreCollectionNames = {
  users: "users",
  vehicles: "vehicles",
  checkIns: "checkIns",
  serviceHistory: "serviceHistory",
  userCoupons: "userCoupons",
  referrals: "referrals",
  punchCards: "punchCards",
  redemptions: "redemptions"
};

export function getFirestorePathForEvent(event: LoyaltySyncQueueEvent, collections: FirestoreCollectionNames = defaultFirestoreCollections): string {
  const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
  const firebaseUid = typeof payload.firebaseUid === "string" && payload.firebaseUid ? payload.firebaseUid : String(payload.customerLocalId ?? "unlinked");
  const vehicleId = String(payload.vehicleLocalId ?? event.entity_id);

  switch (event.event_type) {
    case "customer_upsert":
      return `${collections.users}/${firebaseUid}`;
    case "vehicle_upsert":
      return `${collections.users}/${firebaseUid}/${collections.vehicles}/${vehicleId}`;
    case "completed_service":
      return `${collections.serviceHistory}/${event.entity_id}`;
    case "punch_added":
    case "free_oil_change_earned":
      return `${collections.users}/${firebaseUid}/${collections.vehicles}/${vehicleId}/${collections.punchCards}/${event.id}`;
    case "free_oil_change_redeemed":
      return `${collections.users}/${firebaseUid}/${collections.vehicles}/${vehicleId}/${collections.redemptions}/${event.id}`;
    case "referral_completed":
    case "referral_coupon_issued":
      return `${collections.referrals}/${event.entity_id}`;
    case "coupon_assigned":
    case "coupon_redeemed":
      return `${collections.userCoupons}/${event.entity_id}`;
    case "check_in_completed":
    case "check_in_canceled":
      return `${collections.checkIns}/${event.entity_id}`;
    default:
      return `loyaltyEvents/${event.id}`;
  }
}
