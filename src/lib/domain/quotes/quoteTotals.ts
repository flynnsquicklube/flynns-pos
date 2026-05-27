export interface QuoteTotalLine {
  item_type: string;
  quantity: number;
  unit_price: number;
  taxable: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateQuoteTotals(items: QuoteTotalLine[], taxRate = 0): QuoteTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableSubtotal = 0;
  for (const item of items) {
    const lineTotal = money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));
    if (item.item_type === "discount" || lineTotal < 0) {
      discountTotal += Math.abs(lineTotal);
    } else {
      subtotal += lineTotal;
      if (item.taxable) taxableSubtotal += lineTotal;
    }
  }
  const tax_total = money(Math.max(taxableSubtotal - discountTotal, 0) * taxRate);
  return {
    subtotal: money(subtotal),
    discount_total: money(discountTotal),
    tax_total,
    total: money(Math.max(subtotal - discountTotal, 0) + tax_total)
  };
}
