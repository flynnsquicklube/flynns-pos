export interface RecallLookupRequest {
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
}

export interface NormalizedRecall {
  campaignNumber: string | null;
  component: string | null;
  summary: string | null;
  consequence: string | null;
  remedy: string | null;
  reportReceivedDate: string | null;
  raw: unknown;
}

export interface RecallLookupResult {
  ok: boolean;
  status: "disabled" | "fetched" | "external_link" | "error";
  message: string;
  recalls: NormalizedRecall[];
  externalUrl?: string;
}
