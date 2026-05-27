import { getSetting } from "../db/repositories/settingsRepo";
import type { IntegrationDescriptor, IntegrationStatus } from "./integrationTypes";

async function enabled(key: string): Promise<boolean> {
  const setting = await getSetting(key);
  return setting?.value === "true" || setting?.value === "1";
}

function status(isEnabled: boolean, requiresKey = false, hasKey = false): IntegrationStatus {
  if (!isEnabled) return "disabled";
  if (requiresKey && !hasKey) return "not_configured";
  return "configured";
}

export async function listIntegrationRegistry(): Promise<IntegrationDescriptor[]> {
  const [
    vinEnabled,
    recallEnabled,
    epaEnabled,
    osmEnabled,
    squareEnabled,
    vehicleInfoSearchEnabled,
    localPlateLookupEnabled,
    externalPlateLookupEnabled,
    partFitmentEnabled,
    messagingEnabled,
    accountingEnabled
  ] = await Promise.all([
    enabled("feature.enableNhtsaVinDecoder").then((value) => value || enabled("feature.enableVinDecodeApi")),
    enabled("feature.enableNhtsaRecallLookup"),
    enabled("feature.enableEpaFuelEconomy"),
    enabled("feature.enableOpenStreetMapGeocoding"),
    enabled("feature.enableSquareTerminalSandbox"),
    enabled("feature.enableGoogleVehicleInfoSearch"),
    enabled("feature.enableLocalPlateLookup").then((value) => value || true),
    enabled("feature.enableExternalPlateLookup").then((value) => value || enabled("feature.enablePlateLookupApi")),
    enabled("feature.enablePartFitmentProvider"),
    enabled("feature.enableMessagingProvider"),
    enabled("feature.enableAccountingProvider")
  ]);

  return [
    {
      id: "nhtsa_vpic",
      type: "vin_decoder",
      name: "NHTSA vPIC VIN Decoder",
      provider: "NHTSA vPIC",
      status: status(vinEnabled),
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: true,
      description: "Decodes VINs into year, make, model, trim, engine, body, fuel, drive, and manufacturer data.",
      settingsKeys: ["feature.enableNhtsaVinDecoder", "nhtsa_vpic_base_url", "vin_decode_timeout_ms", "vin_decode_cache_days"]
    },
    {
      id: "nhtsa_recalls",
      type: "recall_lookup",
      name: "NHTSA Recall Lookup",
      provider: "NHTSA",
      status: status(recallEnabled),
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: true,
      description: "Looks up recall campaigns by year, make, and model when manually enabled.",
      settingsKeys: ["feature.enableNhtsaRecallLookup"]
    },
    {
      id: "epa_fueleconomy",
      type: "fuel_economy",
      name: "EPA FuelEconomy.gov",
      provider: "FuelEconomy.gov",
      status: status(epaEnabled),
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: true,
      description: "Matches vehicles by year/make/model and enriches fuel type, class, MPG, engine, transmission, and drive metadata.",
      settingsKeys: ["feature.enableEpaFuelEconomy"]
    },
    {
      id: "osm_nominatim",
      type: "geocoding",
      name: "OpenStreetMap / Nominatim",
      provider: "OpenStreetMap Nominatim",
      status: status(osmEnabled),
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: true,
      description: "Manual, rate-limited geocoding for future address validation and route/distance workflows.",
      settingsKeys: ["feature.enableOpenStreetMapGeocoding"]
    },
    {
      id: "vehicle_info_lookup",
      type: "vehicle_info",
      name: "Vehicle Info Lookup",
      provider: "Local History + Manual Search Links",
      status: "configured",
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: false,
      description: "Uses local service history first, with manual web search links for employee-verified oil capacity, oil type, and filter research.",
      settingsKeys: []
    },
    {
      id: "local_plate_lookup",
      type: "plate_lookup",
      name: "Local Plate Lookup",
      provider: "Local SQLite",
      status: status(localPlateLookupEnabled),
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: false,
      description: "Matches license plate and state against saved local vehicles. This is the active plate workflow.",
      settingsKeys: ["feature.enableLocalPlateLookup"]
    },
    {
      id: "external_plate_lookup",
      type: "plate_lookup",
      name: "External Plate Lookup Provider",
      provider: "Future paid provider",
      status: status(externalPlateLookupEnabled, true, false),
      isFreePublicApi: false,
      requiresApiKey: true,
      requiresInternet: true,
      description: "Prepared architecture for future plate-to-VIN providers. No live lookup is enabled.",
      settingsKeys: ["feature.enableExternalPlateLookup", "feature.enablePlateLookupApi"]
    },
    {
      id: "google_vehicle_info_search",
      type: "vehicle_info",
      name: "Google Programmable Search",
      provider: "Google Custom Search JSON API",
      status: status(vehicleInfoSearchEnabled, true, Boolean(import.meta.env?.VITE_GOOGLE_SEARCH_API_KEY && import.meta.env?.VITE_GOOGLE_SEARCH_CX)),
      isFreePublicApi: false,
      requiresApiKey: true,
      requiresInternet: true,
      description: "Optional search JSON provider for vehicle info snippets. Employees must verify suggestions before saving.",
      settingsKeys: ["feature.enableGoogleVehicleInfoSearch", "VITE_GOOGLE_SEARCH_API_KEY", "VITE_GOOGLE_SEARCH_CX"]
    },
    {
      id: "square_terminal_sandbox",
      type: "payment_terminal",
      name: "Square Terminal Sandbox",
      provider: "Square",
      status: status(squareEnabled, true, Boolean(import.meta.env?.VITE_SQUARE_ACCESS_TOKEN)),
      isFreePublicApi: false,
      requiresApiKey: true,
      requiresInternet: true,
      description: "Sandbox-only architecture for future terminal payments. Manual payment recording remains the active workflow.",
      settingsKeys: ["feature.enableSquareTerminalSandbox", "VITE_SQUARE_ACCESS_TOKEN"]
    },
    {
      id: "local_history_fitment",
      type: "part_fitment",
      name: "Local Service History Fitment",
      provider: "Local SQLite",
      status: "configured",
      isFreePublicApi: true,
      requiresApiKey: false,
      requiresInternet: false,
      description: "Uses saved vehicle defaults, package details, service history, imported ticket data, and inventory search for fitment suggestions.",
      settingsKeys: []
    },
    {
      id: "part_fitment_provider",
      type: "part_fitment",
      name: "Paid Part Fitment Provider",
      provider: "Future provider",
      status: status(partFitmentEnabled, true, false),
      isFreePublicApi: false,
      requiresApiKey: true,
      requiresInternet: true,
      description: "Prepared interface for future Service Champ, ShowMeTheParts, MOTOR, or similar providers.",
      settingsKeys: ["feature.enablePartFitmentProvider"]
    },
    {
      id: "messaging_provider",
      type: "messaging",
      name: "Messaging Provider",
      provider: "Future provider",
      status: status(messagingEnabled, true, false),
      isFreePublicApi: false,
      requiresApiKey: true,
      requiresInternet: true,
      description: "Prepared interface for future email/SMS receipts and customer notifications.",
      settingsKeys: ["feature.enableMessagingProvider"]
    },
    {
      id: "accounting_provider",
      type: "accounting",
      name: "Accounting Provider",
      provider: "Future provider",
      status: status(accountingEnabled, true, false),
      isFreePublicApi: false,
      requiresApiKey: true,
      requiresInternet: true,
      description: "Prepared interface for future accounting exports.",
      settingsKeys: ["feature.enableAccountingProvider"]
    }
  ];
}
