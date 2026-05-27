import { normalizePlate, normalizePlateState } from "../../domain/vehicles/plateUtils";
import type { PlateLookupProvider, PlateLookupRequest, PlateLookupResult } from "./plateLookup.types";

export const externalPlateLookupPlaceholderProvider: PlateLookupProvider = {
  id: "external_plate_lookup_placeholder",
  async lookupPlate(request: PlateLookupRequest): Promise<PlateLookupResult> {
    return {
      status: "not_configured",
      plate: normalizePlate(request.plate),
      state: normalizePlateState(request.state),
      source: "external_placeholder",
      confidence: "none",
      message: "External plate lookup is not configured. Continue with manual vehicle entry."
    };
  }
};
