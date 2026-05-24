export interface FeatureFlags {
  enableFirebaseLoyaltySync: boolean;
  enableVinDecodeApi: boolean;
  enablePlateLookupApi: boolean;
  enableStripeTerminal: boolean;
  enableQuickBooksExport: boolean;
  enableSmsNotifications: boolean;
  enableEmailReceipts: boolean;
  enableInventoryDecrement: boolean;
  enableEmployeeTimeClock: boolean;
  enableCoupons: boolean;
  enableRewards: boolean;
  enableFleetAccounts: boolean;
  enableMultiLocation: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  enableFirebaseLoyaltySync: false,
  enableVinDecodeApi: false,
  enablePlateLookupApi: false,
  enableStripeTerminal: false,
  enableQuickBooksExport: false,
  enableSmsNotifications: false,
  enableEmailReceipts: false,
  enableInventoryDecrement: false,
  enableEmployeeTimeClock: false,
  enableCoupons: false,
  enableRewards: false,
  enableFleetAccounts: false,
  enableMultiLocation: false
};

export function isFeatureEnabled(flag: keyof FeatureFlags, flags: FeatureFlags = defaultFeatureFlags): boolean {
  return Boolean(flags[flag]);
}

