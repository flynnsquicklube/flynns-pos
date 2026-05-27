import { getSetting, setSetting } from "../db/repositories/settingsRepo";
import { defaultBrand } from "./defaultBrand";
import type { BrandConfig } from "./brandTypes";

const brandConfigKey = "brand.config_json";
export const brandChangedEvent = "flynns-brand-config-changed";

function mergeBrandConfig(value: Partial<BrandConfig>): BrandConfig {
  return {
    ...defaultBrand,
    ...value,
    terminology: { ...defaultBrand.terminology, ...value.terminology },
    featureLabels: { ...defaultBrand.featureLabels, ...value.featureLabels }
  };
}

export async function getStoredBrandConfig(): Promise<BrandConfig> {
  const setting = await getSetting(brandConfigKey);
  if (!setting?.value) return { ...defaultBrand };
  try {
    return mergeBrandConfig(JSON.parse(setting.value) as Partial<BrandConfig>);
  } catch {
    return { ...defaultBrand };
  }
}

export async function saveStoredBrandConfig(config: BrandConfig): Promise<void> {
  await setSetting(brandConfigKey, JSON.stringify(mergeBrandConfig(config)));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(brandChangedEvent));
}

export async function resetStoredBrandConfig(): Promise<BrandConfig> {
  await saveStoredBrandConfig(defaultBrand);
  return { ...defaultBrand };
}
