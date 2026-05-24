import type { TicketLineInput } from "../../types/ticket";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";

export interface TicketTotals {
  subtotal: number;
  taxable_subtotal: number;
  discount_total: number;
  fee_total: number;
  tax_total: number;
  total: number;
}

export interface PackageAddonInput {
  name: string;
  quantity: number;
  unit_price: number;
  taxable: number;
  is_fee?: number;
  is_discount?: number;
}

export interface PackagePricingInput {
  selectedPackage: ServicePackage | null;
  actualQuarts: number;
  filterType: PackageFilterType;
  addons: PackageAddonInput[];
  taxRate: number;
}

export interface PackagePricingBreakdown {
  packageBase: number;
  includedQuarts: number;
  actualQuarts: number;
  extraQuarts: number;
  extraQuartTotal: number;
  filterFee: number;
  addonsTotal: number;
  feesTotal: number;
  discountsTotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  subtotal: number;
  total: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeTaxRate(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed > 1 ? parsed / 100 : parsed;
}

export function calculateTicketTotals(lines: TicketLineInput[], taxRateInput = 0): TicketTotals {
  const taxRate = normalizeTaxRate(taxRateInput);
  const discount_total = roundMoney(
    lines.reduce((sum, line) => sum + (line.item_type === "discount" ? Math.abs(line.quantity * line.unit_price) : 0), 0)
  );
  const fee_total = roundMoney(lines.reduce((sum, line) => sum + (line.item_type === "fee" ? line.quantity * line.unit_price : 0), 0));
  const grossSubtotal = roundMoney(lines.reduce((sum, line) => sum + (line.item_type === "discount" ? 0 : line.quantity * line.unit_price), 0));
  const taxable_subtotal = roundMoney(
    lines.reduce((sum, line) => {
      const lineTotal = line.quantity * line.unit_price;
      if (!line.taxable || line.item_type === "discount") return sum;
      return sum + lineTotal;
    }, 0)
  );
  const subtotal = roundMoney(Math.max(grossSubtotal - discount_total, 0));
  const tax_total = roundMoney(Math.max(taxable_subtotal - discount_total, 0) * taxRate);
  return {
    subtotal,
    taxable_subtotal,
    discount_total,
    fee_total,
    tax_total,
    total: roundMoney(Math.max(subtotal + tax_total, 0))
  };
}

export function catalogItemToAddon(item: ServiceCatalogItem, quantity = 1): PackageAddonInput {
  return {
    name: item.name,
    quantity,
    unit_price: item.base_price,
    taxable: item.taxable,
    is_fee: item.is_fee,
    is_discount: item.is_discount
  };
}

export function calculatePackagePricing(input: PackagePricingInput): PackagePricingBreakdown {
  const taxRate = normalizeTaxRate(input.taxRate);
  const packageBase = roundMoney(input.selectedPackage?.base_price ?? 0);
  const includedQuarts = input.selectedPackage?.included_quarts ?? 0;
  const actualQuarts = Math.max(Number(input.actualQuarts) || 0, 0);
  const extraQuarts = input.selectedPackage ? roundMoney(Math.max(0, actualQuarts - includedQuarts)) : 0;
  const extraQuartTotal = roundMoney(extraQuarts * (input.selectedPackage?.extra_quart_price ?? 0));
  const filterFee = input.selectedPackage && input.filterType === "cartridge" ? roundMoney(input.selectedPackage.cartridge_filter_extra_fee) : 0;
  const addonsTotal = roundMoney(
    input.addons.reduce((sum, addon) => sum + (addon.is_fee || addon.is_discount ? 0 : addon.quantity * addon.unit_price), 0)
  );
  const feesTotal = roundMoney(input.addons.reduce((sum, addon) => sum + (addon.is_fee ? addon.quantity * addon.unit_price : 0), 0) + filterFee);
  const discountsTotal = roundMoney(input.addons.reduce((sum, addon) => sum + (addon.is_discount ? Math.abs(addon.quantity * addon.unit_price) : 0), 0));
  const taxableSubtotalBeforeDiscount = roundMoney(
    (input.selectedPackage?.taxable ? packageBase + extraQuartTotal + filterFee : 0) +
      input.addons.reduce((sum, addon) => {
        if (!addon.taxable || addon.is_discount) return sum;
        return sum + addon.quantity * addon.unit_price;
      }, 0)
  );
  const subtotalBeforeDiscount = roundMoney(packageBase + extraQuartTotal + filterFee + addonsTotal + feesTotal - filterFee);
  const subtotal = roundMoney(Math.max(subtotalBeforeDiscount - discountsTotal, 0));
  const taxableSubtotal = roundMoney(Math.max(taxableSubtotalBeforeDiscount - discountsTotal, 0));
  const taxTotal = roundMoney(taxableSubtotal * taxRate);
  return {
    packageBase,
    includedQuarts,
    actualQuarts,
    extraQuarts,
    extraQuartTotal,
    filterFee,
    addonsTotal,
    feesTotal,
    discountsTotal,
    taxableSubtotal,
    taxTotal,
    subtotal,
    total: roundMoney(Math.max(subtotal + taxTotal, 0))
  };
}
