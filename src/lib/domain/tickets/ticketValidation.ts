import type { TicketLineInput } from "../../../types/ticket";

export function validateTicketLines(lines: TicketLineInput[]): string | null {
  if (!lines.length) return "At least one service, package, fee, or custom item is required.";
  const invalid = lines.find((line) => !line.name.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unit_price));
  return invalid ? `Invalid line item: ${invalid.name || "Unnamed item"}.` : null;
}

export function validateFinalMileage(previousMileage: number | null | undefined, finalMileage: number): string | null {
  if (!Number.isFinite(finalMileage) || finalMileage <= 0) return "Final mileage is required.";
  if (previousMileage && finalMileage < previousMileage) return "Final mileage cannot be lower than the current vehicle mileage.";
  return null;
}

