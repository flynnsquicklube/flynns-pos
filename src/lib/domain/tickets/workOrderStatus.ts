export type WorkOrderColumnKey = "open" | "inBay" | "serviceComplete" | "finalized";

export interface WorkOrderStatusLike {
  status: string;
  paymentStatus?: string | null;
  payment_status?: string | null;
}

export function getWorkOrderColumn(ticket: WorkOrderStatusLike): WorkOrderColumnKey {
  if (ticket.status === "completed" || ticket.status === "finalized") return "finalized";
  if (ticket.status === "in_service") return "inBay";
  if (ticket.status === "waiting_payment") return "serviceComplete";
  const paymentStatus = ticket.paymentStatus ?? ticket.payment_status;
  if (paymentStatus === "paid" && ticket.status !== "completed" && ticket.status !== "canceled") return "serviceComplete";
  return "open";
}

export function getWorkOrderStatusLabel(ticket: WorkOrderStatusLike): string {
  const column = getWorkOrderColumn(ticket);
  if (column === "inBay") return "In Bay";
  if (column === "serviceComplete") return "Service Complete";
  if (column === "finalized") return "Finalized";
  if (ticket.status === "checked_in") return "Checked In";
  if (ticket.status === "draft") return "Draft";
  return "Open";
}

export function getWorkOrderStatusPillVariant(ticket: WorkOrderStatusLike): "blue" | "green" | "yellow" | "slate" {
  const column = getWorkOrderColumn(ticket);
  if (column === "inBay") return "blue";
  if (column === "serviceComplete") return "yellow";
  if (column === "finalized") return "green";
  return "slate";
}
