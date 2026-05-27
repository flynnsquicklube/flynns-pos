import { getCachedVehicleInfoSearch, saveVehicleInfoSearchCache } from "../../db/repositories/vehicleInfoLookupRepo";
import { getSetting, setSetting } from "../../db/repositories/settingsRepo";
import { nowIso } from "../../utils/dates";
import { extractVehicleInfoSuggestion } from "./vehicleInfoExtraction";
import type { VehicleInfoLookupResult, VehicleInfoProviderStatus } from "./vehicleInfo.types";

const PROVIDER = "google_programmable_search";

function envValue(key: "VITE_GOOGLE_SEARCH_API_KEY" | "VITE_GOOGLE_SEARCH_CX") {
  return (import.meta.env[key] as string | undefined)?.trim() || "";
}

async function getConfig() {
  const [enabled, keySetting, cxSetting] = await Promise.all([
    getSetting("feature.enableGoogleVehicleInfoSearch"),
    getSetting("google_vehicle_info_search_api_key"),
    getSetting("google_vehicle_info_search_cx")
  ]);
  return {
    enabled: enabled?.value === "true",
    apiKey: envValue("VITE_GOOGLE_SEARCH_API_KEY") || keySetting?.value || "",
    cx: envValue("VITE_GOOGLE_SEARCH_CX") || cxSetting?.value || ""
  };
}

export async function isGoogleVehicleInfoSearchEnabled(): Promise<boolean> {
  return (await getConfig()).enabled;
}

export async function setGoogleVehicleInfoSearchEnabled(enabled: boolean): Promise<void> {
  await setSetting("feature.enableGoogleVehicleInfoSearch", enabled ? "true" : "false");
}

export async function getGoogleVehicleInfoSearchStatus(): Promise<VehicleInfoProviderStatus> {
  const config = await getConfig();
  if (!config.enabled) return { provider: PROVIDER, status: "disabled", message: "Manual search links are available. Google JSON API is disabled." };
  if (!config.apiKey || !config.cx) return { provider: PROVIDER, status: "not_configured", message: "Google API key and Search Engine CX are required." };
  return { provider: PROVIDER, status: "enabled", message: "Google Programmable Search JSON API is configured." };
}

export async function searchVehicleInfoWithGoogle(queryText: string): Promise<{ ok: boolean; message: string; results: VehicleInfoLookupResult[] }> {
  const config = await getConfig();
  if (!config.enabled) return { ok: false, message: "Google vehicle info search is disabled.", results: [] };
  if (!config.apiKey || !config.cx) return { ok: false, message: "Google vehicle info search is not configured.", results: [] };

  const cached = await getCachedVehicleInfoSearch(queryText, PROVIDER);
  const raw = cached ?? await fetchGoogle(queryText, config.apiKey, config.cx);
  if (!cached) {
    await saveVehicleInfoSearchCache(queryText, PROVIDER, raw, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
  }

  const items = (raw as { items?: Array<{ title?: string; link?: string; snippet?: string }> }).items ?? [];
  return {
    ok: true,
    message: items.length ? "Search results loaded. Verify before saving." : "No Google results found.",
    results: items.slice(0, 5).map((item, index) => {
      const suggestion = extractVehicleInfoSuggestion(`${item.title ?? ""} ${item.snippet ?? ""}`, { title: item.title, url: item.link });
      return {
        ...suggestion,
        id: `google-${Date.now()}-${index}`,
        provider: PROVIDER,
        sourceTitle: item.title ?? "Search result",
        sourceUrl: item.link ?? "",
        snippet: item.snippet ?? "",
        query: queryText,
        suggestedOilCapacity: suggestion.oilCapacityQuarts,
        suggestedOilType: suggestion.oilType,
        suggestedOilFilter: suggestion.oilFilterSku,
        suggestedAirFilter: suggestion.airFilterSku,
        suggestedCabinFilter: suggestion.cabinFilterSku,
        raw: item,
        fetchedAt: nowIso()
      };
    })
  };
}

async function fetchGoogle(queryText: string, apiKey: string, cx: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", queryText);
    url.searchParams.set("num", "5");
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`Google search failed (${response.status}).`);
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}
