import { getBusinessProfile } from "../config/businessProfile";
import type { BrandConfig } from "./brandTypes";
import { defaultBrand } from "./defaultBrand";

export async function getBrandConfig(): Promise<BrandConfig> {
  const profile = await getBusinessProfile();
  return {
    ...defaultBrand,
    appName: `${profile.business_name} POS`,
    businessName: profile.business_name,
    logoPath: profile.logo_path,
    primaryColor: profile.primary_color,
    secondaryColor: profile.secondary_color,
    accentColor: profile.accent_color
  };
}

