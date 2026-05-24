import type { TicketStatus } from "../../../types/ticket";

export const activeTicketStatuses: TicketStatus[] = ["checked_in", "in_service", "waiting_payment"];
export const terminalTicketStatuses: TicketStatus[] = ["completed", "canceled"];

export const ticketStatusLabels: Record<TicketStatus, string> = {
  draft: "Draft",
  checked_in: "Checked In",
  in_service: "In Service",
  waiting_payment: "Waiting Payment",
  completed: "Completed",
  canceled: "Canceled"
};

