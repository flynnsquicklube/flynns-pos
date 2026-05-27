import { getBrandConfig, saveBrandConfig } from "../branding/brandService";
import type { BrandConfig } from "../branding/brandTypes";
import { getBusinessProfile, saveBusinessProfile, type BusinessProfile } from "./businessProfile";
import { getPrintSettings, savePrintSettings, type PrintSettings } from "../printing/printSettings";
import { getSetting, setSetting } from "../db/repositories/settingsRepo";
import { createCatalogItem, listCatalogItems, updateCatalogItem } from "../db/repositories/catalogRepo";
import { createPackage, listPackages, updatePackage } from "../db/repositories/packagesRepo";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { ServicePackage } from "../../types/servicePackage";

export interface ShopConfigurationExport {
  schemaVersion: 1;
  exportedAt: string;
  includes: string[];
  businessProfile: BusinessProfile;
  brandConfig: BrandConfig;
  printSettings: PrintSettings;
  loyaltyRules: {
    punchesRequired: string;
    referralRewardAmount: string;
    couponExpirationDays: string;
  };
  packages: ServicePackage[];
  serviceCatalog: ServiceCatalogItem[];
}

export interface ShopConfigurationValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export async function exportShopConfiguration(): Promise<ShopConfigurationExport> {
  const [
    businessProfile,
    brandConfig,
    printSettings,
    packages,
    serviceCatalog,
    punchesRequired,
    referralRewardAmount,
    couponExpirationDays
  ] = await Promise.all([
    getBusinessProfile(),
    getBrandConfig(),
    getPrintSettings(),
    listPackages(),
    listCatalogItems(),
    getSetting("loyalty.punches_required"),
    getSetting("loyalty.referral_reward_amount"),
    getSetting("loyalty.coupon_expiration_days")
  ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    includes: [
      "business_profile",
      "brand_config",
      "print_settings",
      "loyalty_rules",
      "service_packages",
      "service_catalog"
    ],
    businessProfile,
    brandConfig,
    printSettings,
    loyaltyRules: {
      punchesRequired: punchesRequired?.value ?? "5",
      referralRewardAmount: referralRewardAmount?.value ?? "10",
      couponExpirationDays: couponExpirationDays?.value ?? ""
    },
    packages,
    serviceCatalog
  };
}

export function validateShopConfiguration(value: unknown): ShopConfigurationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = value as Partial<ShopConfigurationExport> | null;

  if (!config || typeof config !== "object") errors.push("Configuration must be a JSON object.");
  if (config?.schemaVersion !== 1) errors.push("Unsupported configuration schema version.");
  if (!config?.businessProfile?.business_name) errors.push("Business profile is missing a business name.");
  if (!config?.brandConfig?.appName) errors.push("Brand config is missing an app name.");
  if (!Array.isArray(config?.packages)) warnings.push("No service packages were included.");
  if (!Array.isArray(config?.serviceCatalog)) warnings.push("No service catalog items were included.");

  return { ok: errors.length === 0, errors, warnings };
}

export async function importShopConfiguration(json: string | ShopConfigurationExport): Promise<ShopConfigurationValidation> {
  const config = typeof json === "string" ? JSON.parse(json) as ShopConfigurationExport : json;
  const validation = validateShopConfiguration(config);
  if (!validation.ok) return validation;

  await saveBusinessProfile(config.businessProfile);
  await saveBrandConfig(config.brandConfig);
  await savePrintSettings(config.printSettings);
  await Promise.all([
    setSetting("loyalty.punches_required", config.loyaltyRules.punchesRequired),
    setSetting("loyalty.referral_reward_amount", config.loyaltyRules.referralRewardAmount),
    setSetting("loyalty.coupon_expiration_days", config.loyaltyRules.couponExpirationDays)
  ]);

  const existingPackages = await listPackages();
  for (const servicePackage of config.packages) {
    const match = existingPackages.find((item) => item.id === servicePackage.id || item.name.toLowerCase() === servicePackage.name.toLowerCase());
    const input = {
      name: servicePackage.name,
      description: servicePackage.description,
      category: servicePackage.category,
      base_price: servicePackage.base_price,
      oil_brand: servicePackage.oil_brand,
      oil_type: servicePackage.oil_type,
      included_quarts: servicePackage.included_quarts,
      extra_quart_price: servicePackage.extra_quart_price,
      included_filter_type: servicePackage.included_filter_type,
      cartridge_filter_extra_fee: servicePackage.cartridge_filter_extra_fee,
      max_included_filter_cost: servicePackage.max_included_filter_cost,
      taxable: servicePackage.taxable,
      active: servicePackage.active,
      sort_order: servicePackage.sort_order
    };
    if (match) await updatePackage(match.id, input);
    else await createPackage(input);
  }

  const existingCatalog = await listCatalogItems();
  for (const item of config.serviceCatalog) {
    const match = existingCatalog.find((existing) => existing.id === item.id || existing.name.toLowerCase() === item.name.toLowerCase());
    const input = {
      name: item.name,
      category: item.category,
      description: item.description,
      sku: item.sku,
      base_price: item.base_price,
      cost: item.cost,
      taxable: item.taxable,
      active: item.active,
      is_oil_change: item.is_oil_change,
      is_fee: item.is_fee,
      is_discount: item.is_discount,
      inventory_item_id: item.inventory_item_id,
      sort_order: item.sort_order
    };
    if (match) await updateCatalogItem(match.id, input);
    else await createCatalogItem(input);
  }

  return validation;
}
