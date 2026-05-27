import { calculatePackagePricing } from "../../pricing/pricingEngine";
import type { OilSelectionSuggestion } from "../services/oilSelection";
import type { OilFilterSuggestion } from "../services/oilFilterSuggestion";
import type { PackageFilterType, ServicePackage } from "../../../types/servicePackage";
import type { TicketLineInput } from "../../../types/ticket";

export function buildOilChangePackageLines(input: {
  servicePackage: ServicePackage;
  actualQuarts: string;
  filterType: PackageFilterType;
  selectedOilFilter?: OilFilterSuggestion | null;
  filterChoice?: string | null;
  addOnLines: TicketLineInput[];
  taxRate: number;
}): TicketLineInput[] {
  const oilFilterPrice = input.filterChoice === "customer_supplied" || input.filterChoice === "no_filter" || input.filterChoice === "standard_unmatched"
    ? 0
    : Math.max(Number(input.selectedOilFilter?.retailPrice) || 0, 0);
  const actualQuarts = Number(input.actualQuarts) || input.servicePackage.included_quarts;
  const pricing = calculatePackagePricing({
    selectedPackage: input.servicePackage,
    actualQuarts,
    filterType: input.filterType,
    oilFilterPrice,
    oilFilterCost: input.selectedOilFilter?.cost,
    oilFilterTaxable: 1,
    addons: input.addOnLines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      taxable: line.taxable,
      is_fee: line.item_type === "fee" ? 1 : 0,
      is_discount: line.item_type === "discount" ? 1 : 0
    })),
    taxRate: input.taxRate
  });
  const lines: TicketLineInput[] = [
    {
      service_id: null,
      item_type: "package",
      package_id: input.servicePackage.id,
      inventory_item_id: null,
      name: input.servicePackage.name,
      quantity: 1,
      unit_price: input.servicePackage.package_total ?? input.servicePackage.base_price,
      taxable: input.servicePackage.taxable
    }
  ];
  if (oilFilterPrice > 0 && input.selectedOilFilter) {
    const filterSku = input.selectedOilFilter.sku ?? input.selectedOilFilter.productId ?? "Oil Filter";
    lines.push({
      service_id: null,
      item_type: "inventory",
      package_id: input.servicePackage.id,
      inventory_item_id: input.selectedOilFilter.inventoryItemId ?? null,
      cost: input.selectedOilFilter.cost ?? null,
      sku: input.selectedOilFilter.sku ?? null,
      product_id: input.selectedOilFilter.productId ?? null,
      source_price_type: "inventory_retail",
      name: `Engine Oil Filter - ${filterSku}`,
      quantity: 1,
      unit_price: oilFilterPrice,
      taxable: 1
    });
  }
  if (pricing.extraQuartTotal > 0) {
    lines.push({
      service_id: null,
      item_type: "fee",
      package_id: input.servicePackage.id,
      inventory_item_id: null,
      name: "Extra Oil Quarts",
      quantity: pricing.extraQuarts,
      unit_price: input.servicePackage.extra_quart_price,
      taxable: input.servicePackage.taxable
    });
  }
  if (pricing.filterFee > 0) {
    lines.push({
      service_id: null,
      item_type: "fee",
      package_id: input.servicePackage.id,
      inventory_item_id: null,
      name: "Cartridge Filter Fee",
      quantity: 1,
      unit_price: input.servicePackage.cartridge_filter_extra_fee,
      taxable: input.servicePackage.taxable
    });
  }
  return [...lines, ...input.addOnLines];
}

export function describePackageOperationSelections(input: {
  filterChoice: string | null;
  selectedOilFilter: OilFilterSuggestion | null;
  selectedOil: OilSelectionSuggestion | null;
  actualQuarts: string;
  servicePackage: ServicePackage;
}) {
  return {
    filterLabel: input.filterChoice === "customer_supplied"
      ? "Customer supplied filter"
      : input.filterChoice === "no_filter"
        ? "No filter"
        : input.selectedOilFilter?.sku ?? input.selectedOilFilter?.productId ?? input.selectedOilFilter?.name ?? "Filter required",
    oilLabel: input.selectedOil?.sku ?? input.selectedOil?.name ?? input.servicePackage.oil_type ?? "Oil type required",
    quartsLabel: `${Number(input.actualQuarts) || input.servicePackage.included_quarts} qt`
  };
}
