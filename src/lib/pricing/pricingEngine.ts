import type { ServiceCatalogItem } from "../../types/catalog";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import { calculateTicketTotals, normalizeTaxRate } from "../domain/tickets/ticketTotals";

export { calculateTicketTotals, normalizeTaxRate };
export type TicketTotals = ReturnType<typeof calculateTicketTotals>;

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
  oilFilterPrice?: number;
  oilFilterCost?: number;
  oilFilterTaxable?: number;
  addons: PackageAddonInput[];
  taxRate: number;
}

export interface PackagePricingBreakdown {
  packageBase: number;
  includedQuarts: number;
  actualQuarts: number;
  extraQuarts: number;
  extraQuartTotal: number;
  oilFilterTotal: number;
  selectedFilterRetailPrice: number;
  selectedFilterCost: number;
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
  const packageBase = roundMoney(input.selectedPackage?.package_total ?? input.selectedPackage?.base_price ?? 0);
  const includedQuarts = input.selectedPackage?.included_quarts ?? 0;
  const actualQuarts = Math.max(Number(input.actualQuarts) || 0, 0);
  const extraQuarts = input.selectedPackage ? roundMoney(Math.max(0, actualQuarts - includedQuarts)) : 0;
  const extraQuartTotal = roundMoney(extraQuarts * (input.selectedPackage?.extra_quart_price ?? 0));
  const oilFilterTotal = roundMoney(Math.max(Number(input.oilFilterPrice) || 0, 0));
  const filterFee = input.selectedPackage && input.filterType === "cartridge" ? roundMoney(input.selectedPackage.cartridge_filter_extra_fee) : 0;
  const addonsTotal = roundMoney(
    input.addons.reduce((sum, addon) => sum + (addon.is_fee || addon.is_discount ? 0 : addon.quantity * addon.unit_price), 0)
  );
  const feesTotal = roundMoney(input.addons.reduce((sum, addon) => sum + (addon.is_fee ? addon.quantity * addon.unit_price : 0), 0) + filterFee);
  const discountsTotal = roundMoney(input.addons.reduce((sum, addon) => sum + (addon.is_discount ? Math.abs(addon.quantity * addon.unit_price) : 0), 0));
  const taxableSubtotalBeforeDiscount = roundMoney(
    (input.selectedPackage?.taxable ? packageBase + extraQuartTotal + filterFee : 0) +
      (input.oilFilterTaxable === 0 ? 0 : oilFilterTotal) +
      input.addons.reduce((sum, addon) => {
        if (!addon.taxable || addon.is_discount) return sum;
        return sum + addon.quantity * addon.unit_price;
      }, 0)
  );
  const subtotalBeforeDiscount = roundMoney(packageBase + oilFilterTotal + extraQuartTotal + filterFee + addonsTotal + feesTotal - filterFee);
  const subtotal = roundMoney(Math.max(subtotalBeforeDiscount - discountsTotal, 0));
  const taxableSubtotal = roundMoney(Math.max(taxableSubtotalBeforeDiscount - discountsTotal, 0));
  const taxTotal = roundMoney(taxableSubtotal * taxRate);
  return {
    packageBase,
    includedQuarts,
    actualQuarts,
    extraQuarts,
    extraQuartTotal,
    oilFilterTotal,
    selectedFilterRetailPrice: oilFilterTotal,
    selectedFilterCost: roundMoney(Math.max(Number(input.oilFilterCost) || 0, 0)),
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
