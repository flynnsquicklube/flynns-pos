import type { Customer } from "../../../types/customer";
import type { ServiceHistory } from "../../../types/serviceHistory";
import type { TicketItem, TicketWithDetails } from "../../../types/ticket";
import type { Vehicle } from "../../../types/vehicle";
import type { TicketPackageDetails } from "../../../types/servicePackage";
import type { LoyaltyPayloadBase } from "./loyaltySync.types";

function base(localEventId: string, localEntityId: string): LoyaltyPayloadBase {
  return {
    localEventId,
    localEntityId,
    source: "flynns_pos",
    createdAt: new Date().toISOString(),
    businessId: "flynns_quick_lube",
    locationId: "harrison_oh",
    dryRun: false,
    payloadVersion: 1
  };
}

export function buildCustomerPayload(customer: Customer, localEventId: string) {
  return {
    ...base(localEventId, customer.id),
    customerLocalId: customer.id,
    firebaseUid: customer.firebase_uid,
    firstName: customer.first_name,
    lastName: customer.last_name,
    phone: customer.phone,
    email: customer.email,
    appEmail: customer.app_email ?? null,
    appPhone: customer.app_phone ?? null,
    appLinkStatus: customer.app_link_status ?? "unlinked",
    referralCode: customer.referral_code
  };
}

export function buildVehiclePayload(vehicle: Vehicle, customer: Customer | null, localEventId: string) {
  return {
    ...base(localEventId, vehicle.id),
    customerLocalId: vehicle.customer_id,
    firebaseUid: customer?.firebase_uid ?? null,
    vehicleLocalId: vehicle.id,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    vin: vehicle.vin,
    plate: vehicle.plate,
    plateState: vehicle.plate_state,
    mileage: vehicle.mileage,
    oilType: vehicle.oil_type,
    oilCapacity: vehicle.oil_capacity ?? null,
    oilFilterSku: vehicle.oil_filter_sku ?? null,
    oilFilterInventoryItemId: vehicle.oil_filter_inventory_item_id ?? null,
    lastOilChangeDate: vehicle.last_oil_change_date ?? null,
    lastOilChangeMileage: vehicle.last_oil_change_mileage ?? null
  };
}

export function buildCompletedServicePayload(
  ticket: TicketWithDetails,
  serviceHistory: ServiceHistory,
  vehicle: Vehicle,
  customer: Customer,
  packageDetails: TicketPackageDetails | null,
  items: TicketItem[],
  localEventId: string
) {
  return {
    ...base(localEventId, ticket.id),
    customerLocalId: customer.id,
    firebaseUid: customer.firebase_uid,
    vehicleLocalId: vehicle.id,
    ticketId: ticket.id,
    serviceHistoryId: serviceHistory.id,
    serviceDate: serviceHistory.service_date,
    mileage: serviceHistory.mileage,
    oilType: packageDetails?.oil_type ?? serviceHistory.oil_type,
    oilCapacity: packageDetails?.actual_quarts ?? null,
    oilFilterSku: packageDetails?.oil_filter_sku ?? null,
    oilFilterName: packageDetails?.oil_filter_name ?? null,
    packageName: packageDetails?.package_name ?? null,
    lineItems: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      itemType: item.item_type,
      inventoryItemId: item.inventory_item_id,
      sku: item.sku ?? item.product_id ?? null
    })),
    total: ticket.total,
    paymentStatus: ticket.payment_status,
    sourcePos: "flynns_pos"
  };
}

export function buildPunchAddedPayload(ticket: TicketWithDetails, vehicle: Vehicle, customer: Customer, punchCount: number, freeRewardsAvailable: number, localEventId: string) {
  return {
    ...base(localEventId, ticket.id),
    customerLocalId: customer.id,
    firebaseUid: customer.firebase_uid,
    vehicleLocalId: vehicle.id,
    ticketId: ticket.id,
    punchDelta: 1,
    punchCount,
    freeRewardsAvailable
  };
}

export function buildFreeOilChangeEarnedPayload(vehicle: Vehicle, customer: Customer, freeRewardsAvailable: number, localEventId: string) {
  return {
    ...base(localEventId, vehicle.id),
    customerLocalId: customer.id,
    firebaseUid: customer.firebase_uid,
    vehicleLocalId: vehicle.id,
    freeRewardsAvailable
  };
}

export function buildFreeOilChangeRedeemedPayload(ticket: TicketWithDetails, vehicle: Vehicle, customer: Customer, localEventId: string) {
  return { ...base(localEventId, ticket.id), customerLocalId: customer.id, firebaseUid: customer.firebase_uid, vehicleLocalId: vehicle.id, ticketId: ticket.id };
}

export function buildReferralCompletedPayload(referral: Record<string, unknown>, ticket: TicketWithDetails, localEventId: string) {
  return { ...base(localEventId, String(referral.id)), referral, ticketId: ticket.id };
}

export function buildReferralCouponIssuedPayload(customer: Customer, referral: Record<string, unknown>, amount: number, localEventId: string) {
  return { ...base(localEventId, String(referral.id)), customerLocalId: customer.id, firebaseUid: customer.firebase_uid, referral, amount };
}

export function buildCouponAssignedPayload(customer: Customer, coupon: Record<string, unknown>, localEventId: string) {
  return { ...base(localEventId, String(coupon.id)), customerLocalId: customer.id, firebaseUid: customer.firebase_uid, coupon };
}

export function buildCouponRedeemedPayload(ticket: TicketWithDetails, coupon: Record<string, unknown>, localEventId: string) {
  return { ...base(localEventId, String(coupon.id)), ticketId: ticket.id, coupon };
}

export function buildCheckInCompletedPayload(ticket: TicketWithDetails, checkIn: Record<string, unknown>, localEventId: string) {
  return { ...base(localEventId, String(checkIn.id ?? ticket.check_in_id)), ticketId: ticket.id, checkIn };
}
