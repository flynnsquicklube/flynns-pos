import type { TicketStatus } from "../../../types/ticket";

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  draft: ["checked_in", "canceled"],
  checked_in: ["in_service", "canceled"],
  in_service: ["waiting_payment", "canceled"],
  waiting_payment: ["completed", "canceled"],
  completed: [],
  canceled: ["checked_in"]
};

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function getAllowedTicketActions(status: TicketStatus): TicketStatus[] {
  return allowedTransitions[status] ?? [];
}

export function assertTicketTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransitionTicket(from, to)) {
    throw new Error(`Ticket cannot move from ${from} to ${to}.`);
  }
}

