import type { ServicePackage } from "../../../types/servicePackage";

export const PACKAGE_CATEGORY_ORDER = [
  "Oil Changes",
  "Filters / Wipers",
  "Brakes",
  "Belts / Tune-Up",
  "A/C",
  "Tires",
  "Fluids / Drivetrain",
  "Battery",
  "Labor / Other"
] as const;

export type PackageCategory = typeof PACKAGE_CATEGORY_ORDER[number];

const categorySet = new Set<string>(PACKAGE_CATEGORY_ORDER);

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalCategory(value: string | null | undefined): PackageCategory | null {
  if (value && categorySet.has(value)) return value as PackageCategory;
  const normalized = normalize(value);
  if (!normalized) return null;
  if (normalized.includes("oil change") || normalized === "customer own oil and filter") return "Oil Changes";
  if (normalized.includes("air filter") || normalized.includes("cabin air") || normalized.includes("wiper")) return "Filters / Wipers";
  if (normalized.includes("brake")) return "Brakes";
  if (normalized.includes("belt") || normalized.includes("spark") || normalized.includes("tune")) return "Belts / Tune-Up";
  if (normalized === "a c" || normalized.includes("air condition") || normalized.includes("ac service")) return "A/C";
  if (normalized.includes("tire")) return "Tires";
  if (normalized.includes("fluid") || normalized.includes("drivetrain") || normalized.includes("transmission") || normalized.includes("radiator") || normalized.includes("diff") || normalized.includes("transfer case") || normalized.includes("fuel filter")) return "Fluids / Drivetrain";
  if (normalized.includes("battery")) return "Battery";
  if (normalized.includes("labor") || normalized.includes("general service")) return "Labor / Other";
  return null;
}

export function getPackageCategory(servicePackage: ServicePackage): PackageCategory {
  const savedCategory = canonicalCategory(servicePackage.category);
  if (savedCategory) return savedCategory;

  const groupCategory = canonicalCategory(servicePackage.package_group_name);
  if (groupCategory) return groupCategory;

  const name = normalize(servicePackage.name);
  if (name.includes("oil") || name.includes("synthetic") || name.includes("diesel") || name.includes("conventional")) return "Oil Changes";
  if (name.includes("engine air filter") || name.includes("cabin air filter") || name.includes("wiper")) return "Filters / Wipers";
  if (name.includes("brake") || name.includes("rotor") || name.includes("pad")) return "Brakes";
  if (name.includes("belt") || name.includes("spark") || name.includes("tune")) return "Belts / Tune-Up";
  if (name.includes("air condition") || name.includes("a c") || name.includes(" ac ")) return "A/C";
  if (name.includes("tire") || name.includes("balance") || name.includes("rotation")) return "Tires";
  if (name.includes("transmission") || name.includes("radiator") || name.includes("diff") || name.includes("transfer case") || name.includes("fuel filter")) return "Fluids / Drivetrain";
  if (name.includes("battery")) return "Battery";
  if (name.includes("labor")) return "Labor / Other";
  return "Labor / Other";
}

export function groupPackagesByCategory(packages: ServicePackage[]): Record<PackageCategory, ServicePackage[]> {
  const grouped = PACKAGE_CATEGORY_ORDER.reduce((accumulator, category) => {
    accumulator[category] = [];
    return accumulator;
  }, {} as Record<PackageCategory, ServicePackage[]>);
  packages.forEach((servicePackage) => {
    grouped[getPackageCategory(servicePackage)].push(servicePackage);
  });
  return grouped;
}
