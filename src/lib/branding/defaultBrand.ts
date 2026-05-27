import type { BrandConfig } from "./brandTypes";

export const defaultBrand: BrandConfig = {
  id: "flynns-default",
  appName: "Flynn's POS",
  businessName: "Flynn's Quick Lube",
  legalName: "Flynn's Quick Lube",
  locationName: "Flynn's Quick Lube",
  logoPath: null,
  logoAltText: "Flynn's Quick Lube",
  primaryColor: "#075EC8",
  secondaryColor: "#0B7CFF",
  accentColor: "#075EC8",
  backgroundColor: "#EEF2F7",
  panelColor: "#FFFFFF",
  cardColor: "#FFFFFF",
  textColor: "#0E1B33",
  mutedTextColor: "#5F6F86",
  successColor: "#16A34A",
  warningColor: "#F59E0B",
  dangerColor: "#DC2626",
  mode: "light",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  radiusScale: "lg",
  density: "touch",
  terminology: {
    ticketLabel: "Ticket",
    orderLabel: "Order",
    customerLabel: "Customer",
    vehicleLabel: "Vehicle",
    bayLabel: "Bay",
    packageLabel: "Package",
    serviceLabel: "Service",
    technicianLabel: "Technician",
    couponLabel: "Coupon",
    rewardLabel: "Reward"
  },
  featureLabels: {
    loyaltyName: "Flynn's Loyalty",
    rewardsName: "Flynn's Rewards",
    punchCardName: "Punch Card",
    referralName: "Referral"
  }
};
