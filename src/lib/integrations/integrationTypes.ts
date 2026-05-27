export type IntegrationType =
  | "vin_decoder"
  | "recall_lookup"
  | "fuel_economy"
  | "vehicle_info"
  | "plate_lookup"
  | "geocoding"
  | "payment_terminal"
  | "part_fitment"
  | "messaging"
  | "accounting";

export type IntegrationStatus = "disabled" | "not_configured" | "configured" | "error";

export interface IntegrationDescriptor {
  id: string;
  type: IntegrationType;
  name: string;
  provider: string;
  status: IntegrationStatus;
  isFreePublicApi: boolean;
  requiresApiKey: boolean;
  requiresInternet: boolean;
  description: string;
  settingsKeys: string[];
  lastError?: string | null;
  testConnection?: () => Promise<{ ok: boolean; message: string }>;
}

export function notConfigured<T>(message: string): { ok: false; status: "not_configured"; message: string; data?: T } {
  return { ok: false, status: "not_configured", message };
}
