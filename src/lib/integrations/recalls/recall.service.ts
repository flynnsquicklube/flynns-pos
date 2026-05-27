import { getSetting, setSetting } from "../../db/repositories/settingsRepo";
import { lookupRecallsByVehicle, recallSearchUrl } from "./nhtsaRecall.provider";
import type { RecallLookupRequest, RecallLookupResult } from "./recall.types";

export async function isRecallLookupEnabled(): Promise<boolean> {
  const setting = await getSetting("feature.enableNhtsaRecallLookup");
  return setting?.value === "true" || setting?.value === "1";
}

export async function setRecallLookupEnabled(enabled: boolean): Promise<void> {
  await setSetting("feature.enableNhtsaRecallLookup", enabled ? "true" : "false");
}

export async function lookupRecalls(request: RecallLookupRequest): Promise<RecallLookupResult> {
  if (!(await isRecallLookupEnabled())) {
    return {
      ok: false,
      status: "disabled",
      message: "NHTSA recall lookup is disabled.",
      recalls: [],
      externalUrl: recallSearchUrl(request.year, request.make, request.model, request.vin)
    };
  }
  if (request.year && request.make && request.model) {
    try {
      return await lookupRecallsByVehicle(request.year, request.make, request.model);
    } catch (error) {
      return {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "Recall lookup failed.",
        recalls: [],
        externalUrl: recallSearchUrl(request.year, request.make, request.model, request.vin)
      };
    }
  }
  return {
    ok: true,
    status: "external_link",
    message: "Open NHTSA recall search for this vehicle.",
    recalls: [],
    externalUrl: recallSearchUrl(request.year, request.make, request.model, request.vin)
  };
}
