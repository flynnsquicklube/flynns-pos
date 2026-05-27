import { getSetting } from "../../db/repositories/settingsRepo";
import type { TerminalCheckoutRequest, TerminalCheckoutStatus } from "./paymentTerminal.types";

async function enabled(): Promise<boolean> {
  const setting = await getSetting("feature.enableSquareTerminalSandbox");
  return setting?.value === "true" || setting?.value === "1";
}

function hasSandboxConfig(): boolean {
  return Boolean(import.meta.env?.VITE_SQUARE_ACCESS_TOKEN && import.meta.env?.VITE_SQUARE_LOCATION_ID);
}

export async function getStatus(): Promise<TerminalCheckoutStatus> {
  if (!(await enabled())) return { ok: false, status: "disabled", message: "Square Terminal Sandbox is disabled." };
  if (!hasSandboxConfig()) return { ok: false, status: "not_configured", message: "Square sandbox environment variables are not configured." };
  return { ok: true, status: "pending", message: "Square sandbox configuration is present. Live terminal capture is not shown in the POS payment modal." };
}

export async function createCheckoutRequest(input: TerminalCheckoutRequest): Promise<TerminalCheckoutStatus> {
  void input;
  const status = await getStatus();
  if (!status.ok) return status;
  return { ok: false, status: "disabled", message: "Square checkout creation is guarded until a sandbox device workflow is explicitly tested." };
}

export async function cancelCheckout(requestId: string): Promise<TerminalCheckoutStatus> {
  return { ok: false, status: "disabled", requestId, message: "Square checkout cancellation is not active in local beta." };
}

export async function getCheckoutStatus(requestId: string): Promise<TerminalCheckoutStatus> {
  return { ok: false, status: "disabled", requestId, message: "Square checkout status polling is not active in local beta." };
}
