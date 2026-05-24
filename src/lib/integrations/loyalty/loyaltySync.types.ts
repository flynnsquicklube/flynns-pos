export interface CustomerSyncPayload { customerId: string; firstName: string; lastName: string; phone: string; email?: string | null; }
export interface VehicleSyncPayload { vehicleId: string; customerId: string; mileage?: number | null; oilType?: string | null; }
export interface CompletedServiceSyncPayload { ticketId: string; customerId: string; vehicleId: string; completedAt: string; total: number; services: unknown[]; }
export interface CouponSyncPayload { customerId: string; code: string; status: string; }
export interface ReferralRewardSyncPayload { referrerCustomerId: string; referredCustomerId?: string; rewardStatus: string; }
export interface PunchCardSyncPayload { customerId: string; punchCount: number; rewardEarned: boolean; }
export interface CheckInSyncPayload { customerId: string; vehicleId: string; status: string; }

export type LoyaltySyncPayload =
  | CustomerSyncPayload
  | VehicleSyncPayload
  | CompletedServiceSyncPayload
  | CouponSyncPayload
  | ReferralRewardSyncPayload
  | PunchCardSyncPayload
  | CheckInSyncPayload;

