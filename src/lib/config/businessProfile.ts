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
  tax_id: string;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  default_tax_rate: string;
  currency: string;
  timezone: string;
  invoice_footer: string;
  invoice_disclaimer: string;
  receipt_footer: string;
  sticker_footer: string;
  coupon_disclaimer: string;
  reward_disclaimer: string;
  privacy_url: string;
  support_email: string;
}

export const defaultInvoiceDisclaimer = "Disclaimer; Flynn's Quick Lube LLC, is not responsible for damage caused by theft, fire or acts of nature. I hereby authorize the above repairs, including sublet work, along with the necessary materials. Repair parts and labor are warranted for a period of 30 days from date of service unless otherwise stated. Flynn's Quick Lube will not be responsible for cost of repairs to vehicles that have not first been inspected by Flynn's Quick Lube employees during the 30 day warranty period. Flynn's Quick Lube and or their employees may operate my vehicle for the purpose of testing, inspection and delivery at my risk.\n\nPayment Policy: A 3% processing fee will be added to all payments made by credit card. Customers may avoid this fee by paying with cash or other non-credit payment methods.";

export const defaultBusinessProfile: BusinessProfile = {
  business_name: "Flynn's Quick Lube",
  legal_name: "Flynn's Quick Lube",
  location_name: "Flynn's Quick Lube",
  address_line_1: "1023 Harrison Avenue",
  address_line_2: "",
  city: "Harrison",
  state: "OH",
  zip: "45030",
  phone: "5133671777",
  email: "",
  website: "https://www.carfax.com/Reviews-Flynns-Quick-Lube-Harrison-OH_QKXPAFQ001",
  tax_id: "",
  logo_path: null,
  primary_color: "#075EC8",
  secondary_color: "#0B7CFF",
  accent_color: "#075EC8",
  default_tax_rate: "0",
  currency: "USD",
  timezone: "America/New_York",
  invoice_footer: "Thank you for choosing Flynn's Quick Lube.",
  invoice_disclaimer: defaultInvoiceDisclaimer,
  receipt_footer: "Thank you for choosing Flynn's Quick Lube.",
  sticker_footer: "Thank you for choosing Flynn's Quick Lube.",
  coupon_disclaimer: "Coupons and offers are subject to shop approval.",
  reward_disclaimer: "Rewards are available after qualifying services.",
  privacy_url: "",
  support_email: ""
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
