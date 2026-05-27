export interface BrandTerminology {
  ticketLabel: string;
  orderLabel: string;
  customerLabel: string;
  vehicleLabel: string;
  bayLabel: string;
  packageLabel: string;
  serviceLabel: string;
  technicianLabel: string;
  couponLabel: string;
  rewardLabel: string;
}

export interface BrandFeatureLabels {
  loyaltyName: string;
  rewardsName: string;
  punchCardName: string;
  referralName: string;
}

export interface BrandConfig {
  id: string;
  appName: string;
  businessName: string;
  legalName: string;
  locationName: string;
  logoPath: string | null;
  logoAltText: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  panelColor: string;
  cardColor: string;
  textColor: string;
  mutedTextColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  mode: "dark" | "light";
  fontFamily: string;
  radiusScale: "sm" | "md" | "lg" | "xl";
  density: "comfortable" | "compact" | "touch";
  terminology: BrandTerminology;
  featureLabels: BrandFeatureLabels;
}
