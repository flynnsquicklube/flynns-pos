import { getBusinessProfile } from "../config/businessProfile";
import type { BrandConfig } from "./brandTypes";
import { defaultBrand } from "./defaultBrand";
import { getStoredBrandConfig, saveStoredBrandConfig } from "./brandStorage";

export async function getBrandConfig(): Promise<BrandConfig> {
  const [profile, stored] = await Promise.all([getBusinessProfile(), getStoredBrandConfig()]);
  return {
    ...defaultBrand,
    ...stored,
    appName: stored.appName || `${profile.business_name} POS`,
    businessName: profile.business_name,
    legalName: profile.legal_name,
    locationName: profile.location_name,
    logoPath: profile.logo_path,
    logoAltText: stored.logoAltText || profile.business_name,
    primaryColor: stored.primaryColor || profile.primary_color,
    secondaryColor: stored.secondaryColor || profile.secondary_color,
    accentColor: stored.accentColor || profile.accent_color
  };
}

export async function saveBrandConfig(config: BrandConfig): Promise<void> {
  await saveStoredBrandConfig(config);
}

export function applyBrandConfig(config: BrandConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--pos-blue", config.primaryColor);
  root.style.setProperty("--pos-blue-2", config.secondaryColor);
  root.style.setProperty("--brand-primary", config.primaryColor);
  root.style.setProperty("--brand-accent", config.accentColor);
  root.style.setProperty("--pos-bg", config.backgroundColor || defaultBrand.backgroundColor);
  root.style.setProperty("--pos-panel", config.panelColor || defaultBrand.panelColor);
  root.style.setProperty("--pos-card", config.cardColor || defaultBrand.cardColor);
  root.style.setProperty("--pos-text", config.textColor || defaultBrand.textColor);
  root.style.setProperty("--pos-muted", config.mutedTextColor || defaultBrand.mutedTextColor);
  root.style.setProperty("--pos-success", config.successColor || defaultBrand.successColor);
  root.style.setProperty("--pos-warning", config.warningColor || defaultBrand.warningColor);
  root.style.setProperty("--pos-danger", config.dangerColor || defaultBrand.dangerColor);
}

export function initialsForBrand(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase() || "POS";
}
