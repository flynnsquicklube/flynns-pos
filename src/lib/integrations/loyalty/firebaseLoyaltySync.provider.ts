import { defaultFeatureFlags } from "../../config/featureFlags";
import { disabled, type IntegrationResult } from "../integrationTypes";
import type { Customer } from "../../../types/customer";
import type { Vehicle } from "../../../types/vehicle";
import type { TicketWithDetails } from "../../../types/ticket";
import type { CompletedServiceSyncPayload, CustomerSyncPayload, LoyaltySyncPayload, VehicleSyncPayload } from "./loyaltySync.types";

export function buildCustomerPayload(customer: Customer): CustomerSyncPayload {
  return { customerId: customer.id, firstName: customer.first_name, lastName: customer.last_name, phone: customer.phone, email: customer.email };
}

export function buildVehicleUpdatePayload(vehicle: Vehicle): VehicleSyncPayload {
  return { vehicleId: vehicle.id, customerId: vehicle.customer_id, mileage: vehicle.mileage, oilType: vehicle.oil_type };
}

export function buildCompletedServicePayload(ticket: TicketWithDetails): CompletedServiceSyncPayload {
  return { ticketId: ticket.id, customerId: ticket.customer_id ?? "", vehicleId: ticket.vehicle_id ?? "", completedAt: ticket.completed_at ?? ticket.updated_at, total: ticket.total, services: ticket.items };
}

export async function queueLoyaltySyncEvent(payload: LoyaltySyncPayload): Promise<IntegrationResult<LoyaltySyncPayload>> {
  if (!defaultFeatureFlags.enableFirebaseLoyaltySync) return disabled("Firebase loyalty sync is disabled and not configured.");
  return { ok: true, status: "ready", message: "Loyalty sync event queued.", data: payload };
}

