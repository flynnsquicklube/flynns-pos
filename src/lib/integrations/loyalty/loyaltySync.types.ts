export type LoyaltySyncEventType =
  | "customer_upsert"
  | "vehicle_upsert"
  | "completed_service"
  | "punch_added"
  | "free_oil_change_earned"
  | "free_oil_change_redeemed"
  | "referral_completed"
  | "referral_coupon_issued"
  | "coupon_assigned"
  | "coupon_redeemed"
  | "check_in_completed"
  | "check_in_canceled";

export type LoyaltySyncEntityType = "customer" | "vehicle" | "ticket" | "service_history" | "coupon" | "referral" | "check_in";

export type LoyaltySyncStatus = "pending" | "processing" | "synced" | "failed" | "skipped";

export interface LoyaltyPayloadBase {
  localEventId: string;
  localEntityId: string;
  source: "flynns_pos";
  createdAt: string;
  businessId: string;
  locationId: string;
  dryRun: boolean;
  payloadVersion: 1;
}

export interface LoyaltySyncQueueEvent {
  id: string;
  event_type: LoyaltySyncEventType;
  entity_type: LoyaltySyncEntityType;
  entity_id: string;
  payload_json: string;
  status: LoyaltySyncStatus;
  attempts: number;
  last_error: string | null;
  dry_run_result_json: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  next_retry_at: string | null;
}

export interface LoyaltySyncQueueInput {
  event_type: LoyaltySyncEventType;
  entity_type: LoyaltySyncEntityType;
  entity_id: string;
  payload: Record<string, unknown>;
}

export interface LoyaltySyncQueueStats {
  pending: number;
  processing: number;
  synced: number;
  failed: number;
  skipped: number;
  lastAttempt: string | null;
  lastError: string | null;
}

export interface LoyaltyProviderStatus {
  configured: boolean;
  enabled: boolean;
  status: "not_configured" | "configured_disabled" | "enabled" | "error";
  message: string;
}

export interface LoyaltySyncResult {
  ok: boolean;
  status: "synced" | "dry_run" | "disabled" | "not_configured" | "error";
  message: string;
  mappedPath?: string;
  payload?: Record<string, unknown>;
}
