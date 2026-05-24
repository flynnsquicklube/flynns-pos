import { calculatePackagePricing } from "../../pricing/pricingEngine";
import type { OilSelectionSuggestion } from "../services/oilSelection";
import type { OilFilterSuggestion } from "../services/oilFilterSuggestion";
import type { PackageFilterType, ServicePackage } from "../../../types/servicePackage";
import type { TicketLineInput } from "../../../types/ticket";

export function buildOilChangePackageLines(input: {
  servicePackage: ServicePackage;
  actualQuarts: string;
  filterType: PackageFilterType;
  addOnLines: TicketLineInput[];
  taxRate: number;
}): TicketLineInput[] {
  const actualQuarts = Number(input.actualQuarts) || input.servicePackage.included_quarts;
  const pricing = calculatePackagePricing({
    selectedPackage: input.servicePackage,
    actualQuarts,
    filterType: input.filterType,
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
      unit_price: input.servicePackage.base_price,
      taxable: input.servicePackage.taxable
    }
  ];
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
