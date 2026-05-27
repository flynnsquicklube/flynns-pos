import type { NormalizedRecall, RecallLookupResult } from "./recall.types";

type NhtsaRecallRow = Record<string, string | null>;

function normalize(row: NhtsaRecallRow): NormalizedRecall {
  return {
    campaignNumber: row.NHTSACampaignNumber ?? row.CampaignNumber ?? null,
    component: row.Component ?? null,
    summary: row.Summary ?? null,
    consequence: row.Conequence ?? row.Consequence ?? null,
    remedy: row.Remedy ?? null,
    reportReceivedDate: row.ReportReceivedDate ?? null,
    raw: row
  };
}

export function recallSearchUrl(year?: number | null, make?: string | null, model?: string | null, vin?: string | null): string {
  if (vin) return `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`;
  const params = new URLSearchParams();
  if (year) params.set("modelYear", String(year));
  if (make) params.set("make", make);
  if (model) params.set("model", model);
  return `https://www.nhtsa.gov/recalls?${params.toString()}`;
}

export async function lookupRecallsByVehicle(year: number, make: string, model: string): Promise<RecallLookupResult> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(String(year))}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NHTSA recalls returned ${response.status}.`);
  const raw = await response.json() as { results?: NhtsaRecallRow[]; Results?: NhtsaRecallRow[] };
  const rows = raw.results ?? raw.Results ?? [];
  return {
    ok: true,
    status: "fetched",
    message: `${rows.length} recall record${rows.length === 1 ? "" : "s"} found.`,
    recalls: rows.map(normalize),
    externalUrl: recallSearchUrl(year, make, model)
  };
}
