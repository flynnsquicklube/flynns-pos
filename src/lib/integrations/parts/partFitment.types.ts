export type PartCategory = "oil_filter" | "air_filter" | "cabin_filter" | "wiper" | "bulb" | "oil_capacity" | "wheel_torque";

export interface PartFitmentRequest {
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  category: PartCategory;
}

export interface SuggestedPart {
  category: PartCategory;
  productId?: string | null;
  sku?: string | null;
  brand?: string | null;
  name: string;
  confidence: "high" | "medium" | "low";
  source: string;
  raw?: unknown;
}

export interface SuggestedServiceSpec {
  category: "oil_capacity" | "wheel_torque";
  value: number | string | null;
  unit?: string | null;
  confidence: "high" | "medium" | "low";
  source: string;
  raw?: unknown;
}

export interface PartFitmentResult {
  ok: boolean;
  status: "not_configured" | "ready" | "error";
  message: string;
  parts: SuggestedPart[];
  specs?: SuggestedServiceSpec[];
}
