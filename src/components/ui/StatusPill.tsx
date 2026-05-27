import { Badge } from "./Badge";

type StatusPillStatus =
  | "checked_in"
  | "in_service"
  | "waiting_payment"
  | "completed"
  | "canceled"
  | "unpaid"
  | "partial"
  | "partially_paid"
  | "paid"
  | "imported"
  | "coming_soon"
  | "low_stock"
  | "active"
  | "inactive";

const labels: Record<StatusPillStatus, string> = {
  checked_in: "Checked In",
  in_service: "In Service",
  waiting_payment: "Waiting Payment",
  completed: "Completed",
  canceled: "Canceled",
  unpaid: "Unpaid",
  partial: "Partially Paid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  imported: "Imported",
  coming_soon: "Unavailable",
  low_stock: "Low Stock",
  active: "Active",
  inactive: "Inactive"
};

const tones: Record<StatusPillStatus, "blue" | "green" | "yellow" | "red" | "slate" | "purple"> = {
  checked_in: "blue",
  in_service: "yellow",
  waiting_payment: "purple",
  completed: "green",
  canceled: "red",
  unpaid: "slate",
  partial: "purple",
  partially_paid: "purple",
  paid: "green",
  imported: "blue",
  coming_soon: "slate",
  low_stock: "yellow",
  active: "green",
  inactive: "slate"
};

export function StatusPill({ status, label }: { status: StatusPillStatus; label?: string }) {
  return <Badge tone={tones[status]}>{label ?? labels[status]}</Badge>;
}
