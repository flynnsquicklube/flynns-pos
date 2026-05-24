export interface BrandTerminology {
  ticketLabel: string;
  orderLabel: string;
  customerLabel: string;
  vehicleLabel: string;
  bayLabel: string;
  packageLabel: string;
  serviceLabel: string;
}

export interface BrandConfig {
  appName: string;
  businessName: string;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mode: "dark" | "light";
  terminology: BrandTerminology;
}

