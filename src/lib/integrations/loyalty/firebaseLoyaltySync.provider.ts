import { defaultFeatureFlags } from "../../config/featureFlags";
import { getSetting } from "../../db/repositories/settingsRepo";
import { listPendingEvents, markFailed, markProcessing, markSkipped, markSynced, saveDryRunResult } from "../../db/repositories/loyaltySyncQueueRepo";
import { getFirestorePathForEvent } from "./firestoreMappings";
import type { LoyaltyProviderStatus, LoyaltySyncQueueEvent, LoyaltySyncResult } from "./loyaltySync.types";

async function isLiveSyncEnabled(): Promise<boolean> {
  const setting = await getSetting("feature.enableFirebaseLoyaltySync");
  if (!setting) return defaultFeatureFlags.enableFirebaseLoyaltySync;
  return setting.value === "true" || setting.value === "1";
}

async function hasFirebaseConfig(): Promise<boolean> {
  const projectId = await getSetting("firebase_project_id");
  return Boolean(projectId?.value);
}

export async function getStatus(): Promise<LoyaltyProviderStatus> {
  const [enabled, configured] = await Promise.all([isLiveSyncEnabled(), hasFirebaseConfig()]);
  if (!configured) return { configured: false, enabled, status: "not_configured", message: "Firebase loyalty sync is not configured." };
  if (!enabled) return { configured: true, enabled: false, status: "configured_disabled", message: "Firebase is configured but live loyalty sync is disabled." };
  return { configured: true, enabled: true, status: "enabled", message: "Firebase loyalty sync is enabled." };
}

export async function dryRunEvent(event: LoyaltySyncQueueEvent): Promise<LoyaltySyncResult> {
  const mappedPath = getFirestorePathForEvent(event);
  const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
  const result: LoyaltySyncResult = {
    ok: true,
    status: "dry_run",
    message: `Dry run mapped ${event.event_type} to ${mappedPath}.`,
    mappedPath,
    payload: { ...payload, dryRun: true }
  };
  await saveDryRunResult(event.id, result as unknown as Record<string, unknown>);
  return result;
}

export async function syncEvent(event: LoyaltySyncQueueEvent): Promise<LoyaltySyncResult> {
  const status = await getStatus();
  if (!status.enabled) {
    await markSkipped(event.id, status.message);
    return { ok: false, status: status.configured ? "disabled" : "not_configured", message: status.message };
  }
  await markProcessing(event.id);
  try {
    const dryRun = await dryRunEvent(event);
    await markFailed(event.id, "Live Firestore writes are guarded off in this build.");
    return { ...dryRun, ok: false, status: "error", message: "Live Firestore writes are not implemented in this local beta." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Loyalty sync failed.";
    await markFailed(event.id, message);
    return { ok: false, status: "error", message };
  }
}

export async function syncPendingQueue(limit = 25): Promise<LoyaltySyncResult[]> {
  const events = await listPendingEvents(limit);
  const status = await getStatus();
  if (!status.enabled) {
    return Promise.all(events.map(async (event) => {
      const result = await dryRunEvent(event);
      return { ...result, message: `${result.message} Live sync remains ${status.status}.` };
    }));
  }
  const results: LoyaltySyncResult[] = [];
  for (const event of events) {
    const result = await syncEvent(event);
    if (result.ok) await markSynced(event.id);
    results.push(result);
  }
  return results;
}
