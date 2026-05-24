import { getSetting, setSetting } from "../db/repositories/settingsRepo";

export interface BusinessProfile {
  business_name: string;
  legal_name: string;
  location_name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  default_tax_rate: string;
  currency: string;
  timezone: string;
  invoice_footer: string;
  coupon_disclaimer: string;
  reward_disclaimer: string;
}

export const defaultBusinessProfile: BusinessProfile = {
  business_name: "Flynn's Quick Lube",
  legal_name: "Flynn's Quick Lube",
  location_name: "Flynn's Quick Lube",
  address_line_1: "1023 Harrison Avenue",
  address_line_2: "",
  city: "Harrison",
  state: "OH",
  zip: "45030",
  phone: "",
  email: "",
  website: "",
  logo_path: null,
  primary_color: "#0B7CFF",
  secondary_color: "#00A3FF",
  accent_color: "#0B7CFF",
  default_tax_rate: "0",
  currency: "USD",
  timezone: "America/New_York",
  invoice_footer: "Thank you for choosing Flynn's Quick Lube.",
  coupon_disclaimer: "Coupons and offers are subject to shop approval.",
  reward_disclaimer: "Rewards are Coming Soon."
};

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const entries = await Promise.all(
    Object.keys(defaultBusinessProfile).map(async (key) => [key, await getSetting(`business.${key}`)] as const)
  );
  return entries.reduce<BusinessProfile>((profile, [key, setting]) => ({
    ...profile,
    [key]: setting?.value ?? profile[key as keyof BusinessProfile]
  }), { ...defaultBusinessProfile });
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  await Promise.all(Object.entries(profile).map(([key, value]) => setSetting(`business.${key}`, value ?? "")));
}

