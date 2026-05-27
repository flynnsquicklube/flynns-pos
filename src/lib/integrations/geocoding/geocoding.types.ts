export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  raw: unknown;
}

export interface GeocodingResponse {
  ok: boolean;
  status: "disabled" | "fetched" | "cached" | "rate_limited" | "error";
  message: string;
  results: GeocodeResult[];
}
