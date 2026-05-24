export type IntegrationStatus = "disabled" | "not_configured" | "ready" | "error";

export interface IntegrationResult<T = unknown> {
  ok: boolean;
  status: IntegrationStatus;
  message: string;
  data?: T;
}

export function notConfigured<T = unknown>(message: string): IntegrationResult<T> {
  return { ok: false, status: "not_configured", message };
}

export function disabled<T = unknown>(message: string): IntegrationResult<T> {
  return { ok: false, status: "disabled", message };
}

