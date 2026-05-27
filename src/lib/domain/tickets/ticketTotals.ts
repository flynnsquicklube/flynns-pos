import type { Payment } from "../../../types/payment";
import type { TicketLineInput } from "../../../types/ticket";

export interface TicketTotals {
  subtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  feeTotal: number;
  paidTotal: number;
  amountDue: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeTaxRate(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number((value ?? "").toString().trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed > 1 ? parsed / 100 : parsed;
}

export function taxRateAsPercent(rate: number): number {
  return roundMoney(rate * 100);
}

export function calculateTicketTotals(
  lines: TicketLineInput[],
  payments: Payment[] = [],
  settings: { taxRate?: number | string | null } = {}
): TicketTotals {
  const taxRate = normalizeTaxRate(settings.taxRate ?? 0);
  const discountTotal = roundMoney(
    lines.reduce((sum, line) => sum + (line.item_type === "discount" ? Math.abs(line.quantity * line.unit_price) : 0), 0)
  );
  const feeTotal = roundMoney(lines.reduce((sum, line) => sum + (line.item_type === "fee" ? line.quantity * line.unit_price : 0), 0));
  const grossSubtotal = roundMoney(lines.reduce((sum, line) => sum + (line.item_type === "discount" ? 0 : line.quantity * line.unit_price), 0));
  const taxableSubtotal = roundMoney(
    lines.reduce((sum, line) => {
      if (!line.taxable || line.item_type === "discount") return sum;
      return sum + line.quantity * line.unit_price;
    }, 0)
  );
  const subtotal = roundMoney(Math.max(grossSubtotal - discountTotal, 0));
  const taxTotal = roundMoney(Math.max(taxableSubtotal - discountTotal, 0) * taxRate);
  const total = roundMoney(Math.max(subtotal + taxTotal, 0));
  const paidTotal = roundMoney(
    payments.reduce((sum, payment) => sum + (payment.status === "paid" ? payment.amount : 0), 0)
  );
  const amountDue = roundMoney(Math.max(total - paidTotal, 0));
  return {
    subtotal,
    discountTotal,
    taxableSubtotal,
    taxRate,
    taxTotal,
    feeTotal,
    total,
    paidTotal,
    amountDue
  };
}
