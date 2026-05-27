import type { PackageFilterType, ServicePackage } from "../../../types/servicePackage";

export interface PackageWorkflowValidationInput {
  servicePackage: ServicePackage | null;
  actualQuarts: string;
  filterType: PackageFilterType;
  filterChoice: string | null;
  selectedOilFilterId?: string | null;
  selectedOilSku?: string | null;
  oilType?: string | null;
}

export function getPackageWorkflowValidation(input: PackageWorkflowValidationInput): string[] {
  const missing: string[] = [];
  if (!input.servicePackage) missing.push("Select an oil package.");
  const quarts = Number(input.actualQuarts);
  if (!Number.isFinite(quarts) || quarts <= 0) missing.push("Confirm engine oil capacity.");
  if (!input.filterChoice) missing.push("Confirm oil filter before sending to bay.");
  if ((input.filterType === "standard" || input.filterType === "cartridge") && input.filterChoice === "standard_unmatched") {
    missing.push("Select an inventory oil filter, mark customer supplied, or choose no filter.");
  }
  if ((input.filterType === "standard" || input.filterType === "cartridge") && input.filterChoice !== "customer_supplied" && input.filterChoice !== "no_filter" && !input.selectedOilFilterId) {
    missing.push("Select an inventory oil filter.");
  }
  if (!input.oilType && !input.selectedOilSku) missing.push("Select oil or confirm oil type.");
  if (!input.filterType) missing.push("Select filter type.");
  return missing;
}

export function isPackageWorkflowComplete(input: PackageWorkflowValidationInput): boolean {
  return getPackageWorkflowValidation(input).length === 0;
}
