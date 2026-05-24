export type SyncEngineState = "disabled" | "idle";

export function getSyncEngineState(): { state: SyncEngineState; pendingWork: boolean } {
  return {
    state: "disabled",
    pendingWork: false
  };
}

export async function runPlaceholderSync(): Promise<void> {
  return Promise.resolve();
}
