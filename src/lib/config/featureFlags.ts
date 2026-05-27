export interface FeatureFlags {
  enableFirebaseLoyaltySync: boolean;
  enableLoyaltySyncQueue: boolean;
  enablePunchCards: boolean;
  enableReferralRewards: boolean;
  enableCustomerCoupons: boolean;
  enableCheckInSync: boolean;
  enableVinDecodeApi: boolean;
  enableVinDecodeApiDevMode: boolean;
  enableNhtsaVinDecoder: boolean;
  enableNhtsaRecallLookup: boolean;
  enableEpaFuelEconomy: boolean;
  enableOpenStreetMapGeocoding: boolean;
  enableSquareTerminalSandbox: boolean;
  enablePartFitmentProvider: boolean;
  enableMessagingProvider: boolean;
  enableAccountingProvider: boolean;
  enableGoogleVehicleInfoSearch: boolean;
  enableLocalPlateLookup: boolean;
  enableExternalPlateLookup: boolean;
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
  enableDirectGodexPrinting: boolean;
}

export const defaultFeatureFlags: FeatureFlags = {
  enableFirebaseLoyaltySync: false,
  enableLoyaltySyncQueue: true,
  enablePunchCards: true,
  enableReferralRewards: true,
  enableCustomerCoupons: true,
  enableCheckInSync: true,
  enableVinDecodeApi: true,
  enableVinDecodeApiDevMode: false,
  enableNhtsaVinDecoder: true,
  enableNhtsaRecallLookup: false,
  enableEpaFuelEconomy: false,
  enableOpenStreetMapGeocoding: false,
  enableSquareTerminalSandbox: false,
  enablePartFitmentProvider: false,
  enableMessagingProvider: false,
  enableAccountingProvider: false,
  enableGoogleVehicleInfoSearch: false,
  enableLocalPlateLookup: true,
  enableExternalPlateLookup: false,
  enablePlateLookupApi: false,
  enableStripeTerminal: false,
  enableQuickBooksExport: false,
  enableSmsNotifications: false,
  enableEmailReceipts: false,
  enableInventoryDecrement: false,
  enableEmployeeTimeClock: false,
  enableCoupons: true,
  enableRewards: true,
  enableFleetAccounts: false,
  enableMultiLocation: false,
  enableDirectGodexPrinting: false
};

export function isFeatureEnabled(flag: keyof FeatureFlags, flags: FeatureFlags = defaultFeatureFlags): boolean {
  return Boolean(flags[flag]);
}
