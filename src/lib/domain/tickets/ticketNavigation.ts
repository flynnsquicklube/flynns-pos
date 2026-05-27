import type { TicketWithDetails } from "../../../types/ticket";

export interface TicketRouteState {
  from?: string | null;
  fromLabel?: string | null;
}

export interface TicketBackDestination {
  label: string;
  path: string;
}

const safeDestinations: Record<string, TicketBackDestination> = {
  "/active-bays": { label: "Active Bays", path: "/active-bays" },
  "/check-in-wall": { label: "Check-In Wall", path: "/check-in-wall" },
  "/dashboard": { label: "Dashboard", path: "/dashboard" },
  "/work-orders": { label: "Work Orders", path: "/work-orders" },
  "/waiting-payment": { label: "Waiting Payment", path: "/waiting-payment" },
  "/payment-manager": { label: "Payment Manager", path: "/payment-manager" },
  "/orders": { label: "Orders", path: "/orders" }
};

function normalizeRouteStateDestination(routeState?: TicketRouteState | null): TicketBackDestination | null {
  const from = routeState?.from ?? "";
  if (!from) return null;
  const destination = safeDestinations[from];
  if (!destination) return null;
  return {
    ...destination,
    label: routeState?.fromLabel?.trim() || destination.label
  };
}

export function getTicketBackDestination(ticket: Pick<TicketWithDetails, "status"> | null | undefined, routeState?: TicketRouteState | null): TicketBackDestination {
  const routeDestination = normalizeRouteStateDestination(routeState);
  if (routeDestination) {
    if (ticket?.status === "in_service" && routeDestination.path === "/waiting-payment") {
      return safeDestinations["/active-bays"];
    }
    if (ticket?.status === "waiting_payment" && routeDestination.path === "/active-bays") {
      return safeDestinations["/waiting-payment"];
    }
    return routeDestination;
  }

  if (ticket?.status === "checked_in") {
    return safeDestinations["/check-in-wall"];
  }

  if (ticket?.status === "in_service") {
    return safeDestinations["/active-bays"];
  }

  if (ticket?.status === "waiting_payment") {
    return safeDestinations["/waiting-payment"];
  }

  return safeDestinations["/orders"];
}
