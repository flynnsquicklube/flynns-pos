import type { ServicePackage } from "../../../types/servicePackage";

export const criticalDroptopPackagePrices: Record<string, number> = {
  "Synthetic Blend Oil Change": 58.99,
  "Duramax Full Syn": 68.99,
  "Mobil 1 Full Synthetic": 93.99,
  "Diesel Oil Change": 92.99,
  "Conventional Oil Change": 38.99,
  "Customer Own Oil And Filter": 31.54
};

export interface PackagePricingValidationResult {
  ok: boolean;
  checked: number;
  failures: Array<{ name: string; expected: number; actual: number | null }>;
}

function moneyEquals(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005;
}

export function validateCriticalDroptopPackagePrices(packages: ServicePackage[]): PackagePricingValidationResult {
  const failures: PackagePricingValidationResult["failures"] = [];
  Object.entries(criticalDroptopPackagePrices).forEach(([name, expected]) => {
    const servicePackage = packages.find((row) => row.name === name && row.external_source === "droptop");
    const actual = servicePackage ? Number(servicePackage.package_total ?? servicePackage.base_price) : null;
    if (actual === null || !moneyEquals(actual, expected)) failures.push({ name, expected, actual });
  });
  return {
    ok: failures.length === 0,
    checked: Object.keys(criticalDroptopPackagePrices).length,
    failures
  };
}
