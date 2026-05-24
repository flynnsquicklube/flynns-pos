export type StartTicketSource = "global_search" | "customer_detail" | "vehicle_detail" | "order_detail";

export interface StartTicketContextPayload {
  customerId?: string;
  vehicleId?: string;
  vin?: string;
  startingPoint?: "vehicle" | "customer" | "manual";
  source?: StartTicketSource;
}

let pendingStartTicketContext: StartTicketContextPayload | null = null;

export function setStartTicketContext(payload: StartTicketContextPayload): void {
  pendingStartTicketContext = payload;
}

export function consumeStartTicketContext(): StartTicketContextPayload | null {
  const payload = pendingStartTicketContext;
  pendingStartTicketContext = null;
  return payload;
}

export function clearStartTicketContext(): void {
  pendingStartTicketContext = null;
}
