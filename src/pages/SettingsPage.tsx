import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/useToast";
import { getElectronBridgeDebug, isDesktopDatabaseAvailable, type ElectronBridgeDebug } from "../lib/db/sqlite";
import { createCatalogItem, listCatalogItems, updateCatalogItem } from "../lib/db/repositories/catalogRepo";
import { getImportHistoryEntry, listImportBatches } from "../lib/db/repositories/importRepo";
import { createPackage, duplicatePackage, getNextSortOrder, listPackages, setPackageActive, updatePackage } from "../lib/db/repositories/packagesRepo";
import { getLocalStatus, getSetting, runDatabaseHealthCheck, setSetting, type DatabaseHealthCheck, type LocalStatus } from "../lib/db/repositories/settingsRepo";
import { importDroptopInventory, previewDroptopInventory } from "../lib/import/droptopInventoryImporter";
import { importDroptopOrders, previewDroptopOrders } from "../lib/import/droptopOrdersImporter";
import { importDroptopPackages, previewDroptopPackages } from "../lib/import/droptopPackageImporter";
import type { ImportBatch, ImportHistoryEntry, InventoryImportResult, InventoryPreview, OrdersImportResult, OrdersPreview, PackageImportPreview, PackageImportResult } from "../lib/import/importTypes";
import type { ServiceCatalogItem } from "../types/catalog";
import type { ServicePackage } from "../types/servicePackage";
import { defaultFeatureFlags } from "../lib/config/featureFlags";
import { decodeVinWithFallback, getVinDecoderSettings, isVinDecodeEnabled, setVinDecodeEnabled } from "../lib/integrations/vinDecoder/vinDecoder.service";
import type { VinDecodeResult } from "../lib/integrations/vinDecoder/vinDecoder.types";
import { getSyncQueueStats, listRecentSyncEvents, retryFailedEvents } from "../lib/db/repositories/loyaltySyncQueueRepo";
import { getStatus as getLoyaltyProviderStatus, syncPendingQueue } from "../lib/integrations/loyalty/firebaseLoyaltySync.provider";
import type { LoyaltyProviderStatus, LoyaltySyncQueueEvent, LoyaltySyncQueueStats } from "../lib/integrations/loyalty/loyaltySync.types";
import { defaultPrintSettings, getPrintSettings, savePrintSettings, type PrintSettings } from "../lib/printing/printSettings";
import { createEmployee, listEmployees, updateEmployee, type Employee } from "../lib/db/repositories/employeesRepo";
import { getRecentAuditLogs, listAuditLogs, type AuditLogEntry } from "../lib/db/repositories/auditLogRepo";
import { calculateCloseoutSummary, closeBusinessDay, getCloseoutForDate, getCurrentBusinessDate, listCloseouts, reopenBusinessDay, type CloseoutSummary, type DailyCloseout } from "../lib/db/repositories/dailyCloseoutRepo";
import type { EmployeeRole } from "../lib/security/permissions";
import { DEFAULT_SALES_TAX_RATE, defaultBusinessProfile, getBusinessProfile, getEffectiveTaxRatePercent, saveBusinessProfile, type BusinessProfile } from "../lib/config/businessProfile";
import { applyBrandConfig, getBrandConfig, saveBrandConfig } from "../lib/branding/brandService";
import { defaultBrand } from "../lib/branding/defaultBrand";
import type { BrandConfig } from "../lib/branding/brandTypes";
import { BrandPreviewCard } from "../components/branding/BrandPreviewCard";
import { ThemeColorPicker } from "../components/branding/ThemeColorPicker";
import { exportShopConfiguration, importShopConfiguration, validateShopConfiguration } from "../lib/config/configExportService";
import { createManualBackup, exportDiagnostics, getAppPathsInfo, getPlatformInfo, openAppDataFolder } from "../lib/backup/backupService";
import type { AppPathsInfo, PlatformInfo } from "../lib/backup/backupTypes";
import { getLastSuccessfulBackup, listBackupHistory, type BackupHistoryEntry } from "../lib/db/repositories/backupsRepo";
import { clearResolvedLocalErrors, listLocalErrors, markLocalErrorResolved, type LocalErrorEntry } from "../lib/logging/localErrorLogger";
import { listIntegrationRegistry } from "../lib/integrations/integrationRegistry";
import type { IntegrationDescriptor } from "../lib/integrations/integrationTypes";
import { isFuelEconomyEnabled, searchEpaVehicleCandidates, setFuelEconomyEnabled } from "../lib/integrations/fuelEconomy/fuelEconomy.service";
import type { FuelEconomyVehicleCandidate } from "../lib/integrations/fuelEconomy/fuelEconomy.types";
import { isRecallLookupEnabled, lookupRecalls, setRecallLookupEnabled } from "../lib/integrations/recalls/recall.service";
import type { RecallLookupResult } from "../lib/integrations/recalls/recall.types";
import { isGeocodingEnabled, setGeocodingEnabled } from "../lib/integrations/geocoding/geocoding.service";
import { countFuelEconomyCache } from "../lib/db/repositories/fuelEconomyCacheRepo";
import { getGoogleVehicleInfoSearchStatus, isGoogleVehicleInfoSearchEnabled, setGoogleVehicleInfoSearchEnabled } from "../lib/integrations/vehicleInfo/googleProgrammableSearch.provider";
import type { VehicleInfoProviderStatus } from "../lib/integrations/vehicleInfo/vehicleInfo.types";
import { PackageCard } from "../components/settings/packages/PackageCard";
import { PackageEditorDrawer } from "../components/settings/packages/PackageEditorDrawer";
import { getPackageCategory, groupPackagesByCategory, PACKAGE_CATEGORY_ORDER, type PackageCategory } from "../lib/domain/packages/packageCategories";
import { validateCriticalDroptopPackagePrices } from "../lib/domain/packages/packagePricingValidation";
import { VinCameraScannerModal, type VinScannerResult } from "../components/scanner/VinCameraScannerModal";
import { TouchSelect } from "../components/ui/TouchSelect";

const tabs = ["Business Profile", "Tax", "Services", "Packages", "Import Data", "Printing", "Hardware", "Staff", "Audit Log", "Daily Closeout", "Loyalty Rules", "Database", "Theme/Branding", "Advanced"];

export function SettingsPage() {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [activeTab, setActiveTab] = useState("Business Profile");
  const [taxRate, setTaxRate] = useState("0");
  const [shop, setShop] = useState({ name: defaultBusinessProfile.business_name, address: `${defaultBusinessProfile.address_line_1}, ${defaultBusinessProfile.city}, ${defaultBusinessProfile.state} ${defaultBusinessProfile.zip}`, phone: "" });
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(defaultBusinessProfile);
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(defaultBrand);
  const [shopConfigJson, setShopConfigJson] = useState("");
  const [importConfigJson, setImportConfigJson] = useState("");
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packageEditor, setPackageEditor] = useState<{ mode: "create" | "edit"; servicePackage: ServicePackage | null } | null>(null);
  const [nextPackageSortOrder, setNextPackageSortOrder] = useState(1);
  const [packageSearch, setPackageSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState<"all" | "active" | "inactive">("all");
  const [packageCategoryFilter, setPackageCategoryFilter] = useState<"all" | PackageCategory>("all");
  const [expandedPackageCategories, setExpandedPackageCategories] = useState<Record<string, boolean>>(() => {
    try {
      const saved = window.localStorage.getItem("packages_category_expanded_state");
      if (saved) return JSON.parse(saved) as Record<string, boolean>;
    } catch {
      // Use defaults below.
    }
    return { "Oil Changes": true };
  });
  const [packageConfirm, setPackageConfirm] = useState<ServicePackage | null>(null);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [newCatalogItem, setNewCatalogItem] = useState({ name: "", category: "Filters", base_price: "0", is_fee: false, is_discount: false });
  const [ordersFile, setOrdersFile] = useState<{ name: string; text: string } | null>(null);
  const [inventoryFile, setInventoryFile] = useState<{ name: string; text: string } | null>(null);
  const [packageProfileFile, setPackageProfileFile] = useState<{ name: string; text: string } | null>(null);
  const [packageAccessibilityFile, setPackageAccessibilityFile] = useState<{ name: string; text: string } | null>(null);
  const [ordersPreview, setOrdersPreview] = useState<OrdersPreview | null>(null);
  const [inventoryPreview, setInventoryPreview] = useState<InventoryPreview | null>(null);
  const [packageImportPreview, setPackageImportPreview] = useState<PackageImportPreview | null>(null);
  const [ordersResult, setOrdersResult] = useState<OrdersImportResult | null>(null);
  const [inventoryResult, setInventoryResult] = useState<InventoryImportResult | null>(null);
  const [packageImportResult, setPackageImportResult] = useState<PackageImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ImportHistoryEntry | null>(null);
  const [bridgeDebug, setBridgeDebug] = useState<ElectronBridgeDebug>(() => getElectronBridgeDebug());
  const [health, setHealth] = useState<DatabaseHealthCheck | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [appPaths, setAppPaths] = useState<AppPathsInfo | null>(null);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [lastBackup, setLastBackup] = useState<BackupHistoryEntry | null>(null);
  const [localErrors, setLocalErrors] = useState<LocalErrorEntry[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [vinDecoderEnabled, setVinDecoderEnabledState] = useState(false);
  const [vinTestInput, setVinTestInput] = useState("");
  const [vinTestResult, setVinTestResult] = useState<VinDecodeResult | null>(null);
  const [vinTesting, setVinTesting] = useState(false);
  const [vinSettings, setVinSettings] = useState({ provider: "nhtsa_vpic", baseUrl: "https://vpic.nhtsa.dot.gov/api", timeoutMs: 8000, cacheDays: 365 });
  const [integrations, setIntegrations] = useState<IntegrationDescriptor[]>([]);
  const [epaEnabled, setEpaEnabled] = useState(false);
  const [recallEnabled, setRecallEnabled] = useState(false);
  const [geocodingEnabled, setGeocodingEnabledState] = useState(false);
  const [epaCacheCount, setEpaCacheCount] = useState(0);
  const [epaTest, setEpaTest] = useState({ year: "2020", make: "Toyota", model: "Camry" });
  const [epaResults, setEpaResults] = useState<FuelEconomyVehicleCandidate[]>([]);
  const [epaTesting, setEpaTesting] = useState(false);
  const [recallTest, setRecallTest] = useState({ year: "2020", make: "Toyota", model: "Camry" });
  const [recallResult, setRecallResult] = useState<RecallLookupResult | null>(null);
  const [vehicleInfoSearchEnabled, setVehicleInfoSearchEnabled] = useState(false);
  const [vehicleInfoSearchStatus, setVehicleInfoSearchStatus] = useState<VehicleInfoProviderStatus | null>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyProviderStatus | null>(null);
  const [loyaltyStats, setLoyaltyStats] = useState<LoyaltySyncQueueStats | null>(null);
  const [loyaltyEvents, setLoyaltyEvents] = useState<LoyaltySyncQueueEvent[]>([]);
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [loyaltyRules, setLoyaltyRules] = useState({ punchesRequired: "5", referralRewardAmount: "10", couponExpirationDays: "" });
  const [printSettings, setPrintSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [hardwareScannerOpen, setHardwareScannerOpen] = useState(false);
  const [hardwareScannerResult, setHardwareScannerResult] = useState<VinScannerResult | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeForm, setEmployeeForm] = useState({ id: "", first_name: "", last_name: "", display_name: "", email: "", phone: "", role: "technician" as EmployeeRole, hourly_rate: "", active: true, pin: "" });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [closeoutDate, setCloseoutDate] = useState(getCurrentBusinessDate());
  const [closeoutSummary, setCloseoutSummary] = useState<CloseoutSummary | null>(null);
  const [closeout, setCloseout] = useState<DailyCloseout | null>(null);
  const [closeouts, setCloseouts] = useState<DailyCloseout[]>([]);
  const [cashCounted, setCashCounted] = useState("");
  const [closeoutNotes, setCloseoutNotes] = useState("");
  const { notify } = useToast();

  const refreshLoyaltySync = async () => {
    const [providerStatus, stats, events] = await Promise.all([getLoyaltyProviderStatus(), getSyncQueueStats(), listRecentSyncEvents(8)]);
    setLoyaltyStatus(providerStatus);
    setLoyaltyStats(stats);
    setLoyaltyEvents(events);
  };

  const refreshIntegrations = async () => {
    const [registry, fuelEnabled, recallsEnabled, geoEnabled, cacheCount, googleVehicleEnabled, googleVehicleStatus] = await Promise.all([
      listIntegrationRegistry(),
      isFuelEconomyEnabled(),
      isRecallLookupEnabled(),
      isGeocodingEnabled(),
      countFuelEconomyCache().catch(() => 0),
      isGoogleVehicleInfoSearchEnabled(),
      getGoogleVehicleInfoSearchStatus()
    ]);
    setIntegrations(registry);
    setEpaEnabled(fuelEnabled);
    setRecallEnabled(recallsEnabled);
    setGeocodingEnabledState(geoEnabled);
    setEpaCacheCount(cacheCount);
    setVehicleInfoSearchEnabled(googleVehicleEnabled);
    setVehicleInfoSearchStatus(googleVehicleStatus);
  };

  const refreshDatabaseTools = async () => {
    const [paths, platform, backups, latestBackup, errors] = await Promise.all([
      getAppPathsInfo().catch(() => null),
      getPlatformInfo().catch(() => null),
      listBackupHistory(12).catch(() => []),
      getLastSuccessfulBackup().catch(() => null),
      listLocalErrors(8, false).catch(() => [])
    ]);
    setAppPaths(paths);
    setPlatformInfo(platform);
    setBackupHistory(backups);
    setLastBackup(latestBackup);
    setLocalErrors(errors);
  };

  useEffect(() => {
    setBridgeDebug(getElectronBridgeDebug());
    getLocalStatus().then(setStatus).catch(() => setStatus(null));
    getEffectiveTaxRatePercent().then((effectiveRate) => setTaxRate(String(effectiveRate))).catch(() => setTaxRate(String(DEFAULT_SALES_TAX_RATE)));
    getBusinessProfile().then((profile) => {
      setBusinessProfile(profile);
      setShop({
        name: profile.business_name,
        address: [profile.address_line_1, profile.city, profile.state, profile.zip].filter(Boolean).join(", "),
        phone: profile.phone
      });
    }).catch(() => undefined);
    getBrandConfig().then((brand) => {
      setBrandConfig(brand);
      applyBrandConfig(brand);
    }).catch(() => undefined);
    Promise.all([getSetting("shop_name"), getSetting("shop_address"), getSetting("shop_phone")]).then(([name, address, phone]) => {
      setShop({
        name: name?.value ?? defaultBusinessProfile.business_name,
        address: address?.value ?? `${defaultBusinessProfile.address_line_1}, ${defaultBusinessProfile.city}, ${defaultBusinessProfile.state} ${defaultBusinessProfile.zip}`,
        phone: phone?.value ?? ""
      });
    }).catch(() => undefined);
    listPackages().then(setPackages).catch(() => setPackages([]));
    getNextSortOrder().then(setNextPackageSortOrder).catch(() => setNextPackageSortOrder(1));
    listCatalogItems().then(setCatalogItems).catch(() => setCatalogItems([]));
    listImportBatches().then(setImportHistory).catch(() => setImportHistory([]));
    isVinDecodeEnabled().then(setVinDecoderEnabledState).catch(() => setVinDecoderEnabledState(false));
    getVinDecoderSettings().then(setVinSettings).catch(() => undefined);
    refreshIntegrations().catch(() => undefined);
    getPrintSettings().then(setPrintSettings).catch(() => undefined);
    refreshDatabaseTools().catch(() => undefined);
    listEmployees().then(setEmployees).catch(() => setEmployees([]));
    getRecentAuditLogs(30).then(setAuditLogs).catch(() => setAuditLogs([]));
    void loadCloseout(getCurrentBusinessDate());
    refreshLoyaltySync().catch(() => undefined);
    Promise.all([getSetting("loyalty.punches_required"), getSetting("loyalty.referral_reward_amount"), getSetting("loyalty.coupon_expiration_days")]).then(([punches, referral, expiration]) => {
      setLoyaltyRules({
        punchesRequired: punches?.value ?? "5",
        referralRewardAmount: referral?.value ?? "10",
        couponExpirationDays: expiration?.value ?? ""
      });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("packages_category_expanded_state", JSON.stringify(expandedPackageCategories));
  }, [expandedPackageCategories]);

  const readCsvFile = async (file: File): Promise<{ name: string; text: string }> => ({ name: file.name, text: await file.text() });

  const saveTaxRate = async () => {
    const nextProfile = { ...businessProfile, default_tax_rate: taxRate };
    await Promise.all([setSetting("tax_rate", taxRate), saveBusinessProfile(nextProfile)]);
    setBusinessProfile(nextProfile);
    notify({ tone: "success", title: "Tax rate saved", message: `${taxRate}% will be used for new tickets.` });
  };
  const saveShop = async () => {
    const nextProfile = { ...businessProfile, business_name: shop.name, location_name: shop.name, phone: shop.phone };
    await Promise.all([setSetting("shop_name", shop.name), setSetting("shop_address", shop.address), setSetting("shop_phone", shop.phone), saveBusinessProfile(nextProfile)]);
    setBusinessProfile(nextProfile);
    const nextBrand = await getBrandConfig();
    setBrandConfig(nextBrand);
    applyBrandConfig(nextBrand);
    notify({ tone: "success", title: "Operation saved", message: shop.name });
  };
  const saveBusinessProfileSettings = async () => {
    await Promise.all([
      saveBusinessProfile(businessProfile),
      setSetting("tax_rate", businessProfile.default_tax_rate),
      setSetting("shop_name", businessProfile.business_name),
      setSetting("shop_address", [businessProfile.address_line_1, businessProfile.city, businessProfile.state, businessProfile.zip].filter(Boolean).join(", ")),
      setSetting("shop_phone", businessProfile.phone)
    ]);
    setTaxRate(businessProfile.default_tax_rate);
    setShop({
      name: businessProfile.business_name,
      address: [businessProfile.address_line_1, businessProfile.city, businessProfile.state, businessProfile.zip].filter(Boolean).join(", "),
      phone: businessProfile.phone
    });
    const nextBrand = await getBrandConfig();
    setBrandConfig(nextBrand);
    applyBrandConfig(nextBrand);
    notify({ tone: "success", title: "Business profile saved", message: businessProfile.business_name });
  };
  const saveBrandSettings = async () => {
    await saveBrandConfig(brandConfig);
    applyBrandConfig(brandConfig);
    notify({ tone: "success", title: "Branding saved", message: "The local POS theme has been updated." });
  };
  const resetFlynnDefaults = async () => {
    await Promise.all([saveBusinessProfile(defaultBusinessProfile), saveBrandConfig(defaultBrand)]);
    setBusinessProfile(defaultBusinessProfile);
    setBrandConfig(defaultBrand);
    setTaxRate(defaultBusinessProfile.default_tax_rate);
    applyBrandConfig(defaultBrand);
    notify({ tone: "success", title: "Flynn's defaults restored", message: "Branding and business profile were reset." });
  };
  const exportConfig = async () => {
    const config = await exportShopConfiguration();
    setShopConfigJson(JSON.stringify(config, null, 2));
    notify({ tone: "success", title: "Shop config exported", message: "Settings-only JSON is ready to review." });
  };
  const importConfig = async () => {
    try {
      const parsed = JSON.parse(importConfigJson) as unknown;
      const validation = validateShopConfiguration(parsed);
      if (!validation.ok) {
        notify({ tone: "error", title: "Config import blocked", message: validation.errors.join(" ") });
        return;
      }
      if (!window.confirm("Import shop settings now? This updates branding, profile, packages, catalog, loyalty rules, and print settings. Customer and sales data are not touched.")) return;
      const result = await importShopConfiguration(importConfigJson);
      if (!result.ok) {
        notify({ tone: "error", title: "Config import failed", message: result.errors.join(" ") });
        return;
      }
      const [profile, brand, print, servicePackages, catalog] = await Promise.all([getBusinessProfile(), getBrandConfig(), getPrintSettings(), listPackages(), listCatalogItems()]);
      setBusinessProfile(profile);
      setBrandConfig(brand);
      setPrintSettings(print);
      setPackages(servicePackages);
      setCatalogItems(catalog);
      applyBrandConfig(brand);
      notify({ tone: "success", title: "Shop config imported", message: result.warnings[0] ?? "Settings were updated without touching customer data." });
    } catch (error) {
      notify({ tone: "error", title: "Config import failed", message: error instanceof Error ? error.message : "Invalid JSON." });
    }
  };
  const savePrinting = async () => {
    await savePrintSettings(printSettings);
    notify({ tone: "success", title: "Printing settings saved", message: "New print jobs will use these defaults." });
  };
  const createBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await createManualBackup();
      await refreshDatabaseTools();
      notify({ tone: result.ok ? "success" : "error", title: result.ok ? "Backup created" : "Backup not created", message: result.ok ? result.fileName ?? "Database backup saved." : result.error ?? "Backup failed." });
    } catch (error) {
      notify({ tone: "error", title: "Backup failed", message: error instanceof Error ? error.message : "Unable to create backup." });
    } finally {
      setBackupBusy(false);
    }
  };
  const exportDiagnosticBundle = async () => {
    setDiagnosticsBusy(true);
    try {
      const result = await exportDiagnostics();
      notify({ tone: result.ok ? "success" : "error", title: result.ok ? "Diagnostics exported" : "Diagnostics not exported", message: result.ok ? result.fileName ?? "Diagnostic JSON saved." : result.error ?? "Export failed." });
      await refreshDatabaseTools();
    } catch (error) {
      notify({ tone: "error", title: "Diagnostics failed", message: error instanceof Error ? error.message : "Unable to export diagnostics." });
    } finally {
      setDiagnosticsBusy(false);
    }
  };
  const copyDiagnosticInfo = async () => {
    const info = {
      app: platformInfo,
      paths: appPaths,
      database: status,
      lastBackup: lastBackup ? { file_name: lastBackup.file_name, created_at: lastBackup.created_at, status: lastBackup.status } : null
    };
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    notify({ tone: "success", title: "Diagnostic info copied", message: "Path and platform details copied to clipboard." });
  };
  const copyDatabasePath = async () => {
    const path = appPaths?.databasePath ?? status?.databasePath;
    if (!path) {
      notify({ tone: "error", title: "Database path unavailable", message: "Open the Electron desktop app to copy the database path." });
      return;
    }
    await navigator.clipboard.writeText(path);
    notify({ tone: "success", title: "Database path copied", message: path });
  };

  const reloadPackages = async () => {
    const [rows, nextSort] = await Promise.all([listPackages(), getNextSortOrder()]);
    setPackages(rows);
    setNextPackageSortOrder(nextSort);
  };

  const savePackageEditor = async (input: Parameters<typeof createPackage>[0]) => {
    if (packageEditor?.mode === "edit" && packageEditor.servicePackage) {
      await updatePackage(packageEditor.servicePackage.id, input);
      notify({ tone: "success", title: "Package updated", message: "New tickets will use this pricing." });
    } else {
      await createPackage(input);
      notify({ tone: "success", title: "Package added", message: "New tickets will use this package when active." });
    }
    setPackageEditor(null);
    await reloadPackages();
  };

  const duplicateServicePackage = async (servicePackage: ServicePackage) => {
    const copy = await duplicatePackage(servicePackage.id);
    await reloadPackages();
    setPackageEditor({ mode: "edit", servicePackage: copy });
    notify({ tone: "success", title: "Package duplicated", message: "The copy is inactive until you enable it." });
  };

  const togglePackageActive = async (servicePackage: ServicePackage) => {
    await setPackageActive(servicePackage.id, !servicePackage.active);
    await reloadPackages();
    notify({ tone: "success", title: servicePackage.active ? "Package disabled" : "Package enabled", message: servicePackage.active ? "It will no longer appear on new tickets." : "It can now appear on new tickets." });
  };
  const saveEmployee = async () => {
    if (!employeeForm.first_name.trim() || !employeeForm.last_name.trim()) {
      notify({ tone: "error", title: "Employee name required", message: "Enter first and last name." });
      return;
    }
    const payload = {
      first_name: employeeForm.first_name.trim(),
      last_name: employeeForm.last_name.trim(),
      display_name: employeeForm.display_name.trim() || `${employeeForm.first_name} ${employeeForm.last_name}`.trim(),
      email: employeeForm.email.trim() || null,
      phone: employeeForm.phone.trim() || null,
      role: employeeForm.role,
      hourly_rate: employeeForm.hourly_rate ? Number(employeeForm.hourly_rate) : null,
      active: employeeForm.active ? 1 : 0,
      pin: employeeForm.pin.trim() || null
    };
    if (employeeForm.id) await updateEmployee(employeeForm.id, payload);
    else await createEmployee(payload);
    setEmployees(await listEmployees());
    setEmployeeForm({ id: "", first_name: "", last_name: "", display_name: "", email: "", phone: "", role: "technician", hourly_rate: "", active: true, pin: "" });
    notify({ tone: "success", title: "Employee saved", message: payload.display_name });
  };

  const editEmployee = (employee: Employee) => setEmployeeForm({
    id: employee.id,
    first_name: employee.first_name,
    last_name: employee.last_name,
    display_name: employee.display_name,
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    role: employee.role,
    hourly_rate: employee.hourly_rate === null ? "" : String(employee.hourly_rate),
    active: Boolean(employee.active),
    pin: ""
  });

  const refreshAudit = async () => {
    setAuditLogs(await listAuditLogs({ search: auditSearch, limit: 100 }));
  };

  const loadCloseout = async (date: string) => {
    const [summary, existing, recent] = await Promise.all([calculateCloseoutSummary(date), getCloseoutForDate(date), listCloseouts()]);
    setCloseoutSummary(summary);
    setCloseout(existing);
    setCloseouts(recent);
    setCashCounted(existing?.cash_counted === null || existing?.cash_counted === undefined ? "" : String(existing.cash_counted));
    setCloseoutNotes(existing?.notes ?? "");
  };

  const closeDay = async () => {
    if (!closeoutSummary) return;
    if ((closeoutSummary.openTicketCount || closeoutSummary.waitingPaymentCount) && !window.confirm("There are still active or waiting-payment tickets. Close the day anyway?")) return;
    const saved = await closeBusinessDay({ businessDate: closeoutDate, cashCounted: Number(cashCounted) || 0, notes: closeoutNotes || null });
    setCloseout(saved);
    setCloseouts(await listCloseouts());
    notify({ tone: "success", title: "Business day closed", message: closeoutDate });
  };

  const saveCatalogItem = async (item: ServiceCatalogItem) => {
    await updateCatalogItem(item.id, item);
    setCatalogItems(await listCatalogItems());
    notify({ tone: "success", title: "Catalog item saved", message: item.name });
  };

  const addCatalogItem = async () => {
    if (!newCatalogItem.name.trim()) {
      notify({ tone: "error", title: "Name required", message: "Enter a catalog item name." });
      return;
    }
    await createCatalogItem({
      name: newCatalogItem.name.trim(),
      category: newCatalogItem.category.trim() || "Other",
      base_price: Number(newCatalogItem.base_price) || 0,
      is_fee: newCatalogItem.is_fee ? 1 : 0,
      is_discount: newCatalogItem.is_discount ? 1 : 0,
      taxable: newCatalogItem.is_discount ? 0 : 1,
      active: 1
    });
    setCatalogItems(await listCatalogItems());
    setNewCatalogItem({ name: "", category: "Filters", base_price: "0", is_fee: false, is_discount: false });
    notify({ tone: "success", title: "Catalog item added", message: "Available for new tickets." });
  };

  const checkDatabase = async () => {
    setCheckingHealth(true);
    try {
      const result = await runDatabaseHealthCheck();
      setHealth(result);
      notify({
        tone: result.errors.length ? "error" : result.warnings.length ? "info" : "success",
        title: result.errors.length ? "Database check found errors" : result.warnings.length ? "Database check found warnings" : "Database check passed",
        message: `${result.passed.length} checks passed, ${result.warnings.length} warnings, ${result.errors.length} errors.`
      });
    } catch (error) {
      notify({ tone: "error", title: "Database check failed", message: error instanceof Error ? error.message : "Unable to run health check." });
    } finally {
      setCheckingHealth(false);
    }
  };

  const toggleVinDecoder = async (enabled: boolean) => {
    await setVinDecodeEnabled(enabled);
    await setSetting("feature.enableNhtsaVinDecoder", enabled ? "true" : "false");
    setVinDecoderEnabledState(enabled);
    await refreshIntegrations();
    notify({ tone: "success", title: enabled ? "VIN decoder enabled" : "VIN decoder disabled", message: "Start Ticket will still search local vehicles first." });
  };

  const testVinDecode = async () => {
    if (!vinDecoderEnabled) {
      notify({ tone: "info", title: "VIN decoder disabled", message: "Enable VIN Decoder before testing NHTSA vPIC." });
      return;
    }
    setVinTesting(true);
    try {
      const result = await decodeVinWithFallback(vinTestInput, { forceRefresh: true });
      setVinTestResult(result);
      notify({ tone: result.ok ? "success" : "error", title: result.ok ? "VIN decoded" : "VIN decode failed", message: result.message });
    } finally {
      setVinTesting(false);
    }
  };

  const toggleEpa = async (enabled: boolean) => {
    await setFuelEconomyEnabled(enabled);
    await refreshIntegrations();
    notify({ tone: "success", title: enabled ? "EPA data enabled" : "EPA data disabled", message: "Vehicle matching stays manual and cached." });
  };

  const testEpa = async () => {
    setEpaTesting(true);
    try {
      const result = await searchEpaVehicleCandidates(Number(epaTest.year), epaTest.make, epaTest.model);
      setEpaResults(result.data ?? []);
      await refreshIntegrations();
      notify({ tone: result.ok ? "success" : "error", title: result.ok ? "EPA lookup complete" : "EPA lookup failed", message: result.message });
    } finally {
      setEpaTesting(false);
    }
  };

  const toggleRecalls = async (enabled: boolean) => {
    await setRecallLookupEnabled(enabled);
    await refreshIntegrations();
    notify({ tone: "success", title: enabled ? "Recall lookup enabled" : "Recall lookup disabled" });
  };

  const testRecalls = async () => {
    const result = await lookupRecalls({ year: Number(recallTest.year), make: recallTest.make, model: recallTest.model });
    setRecallResult(result);
    notify({ tone: result.ok ? "success" : "error", title: result.ok ? "Recall lookup complete" : "Recall lookup unavailable", message: result.message });
  };

  const toggleGeocoding = async (enabled: boolean) => {
    await setGeocodingEnabled(enabled);
    await refreshIntegrations();
    notify({ tone: "success", title: enabled ? "Geocoding enabled" : "Geocoding disabled", message: "Geocoding is manual and rate-limited." });
  };

  const toggleVehicleInfoSearch = async (enabled: boolean) => {
    await setGoogleVehicleInfoSearchEnabled(enabled);
    await refreshIntegrations();
    notify({ tone: "success", title: enabled ? "Vehicle info search enabled" : "Vehicle info search disabled", message: "Manual search links and local history remain available." });
  };

  const dryRunLoyaltySync = async () => {
    setLoyaltyBusy(true);
    try {
      const results = await syncPendingQueue(25);
      await refreshLoyaltySync();
      notify({ tone: "success", title: "Dry run complete", message: `${results.length} pending loyalty event${results.length === 1 ? "" : "s"} mapped locally.` });
    } catch (error) {
      notify({ tone: "error", title: "Dry run failed", message: error instanceof Error ? error.message : "Unable to dry run loyalty sync." });
    } finally {
      setLoyaltyBusy(false);
    }
  };

  const retryLoyaltyFailures = async () => {
    setLoyaltyBusy(true);
    try {
      const count = await retryFailedEvents();
      await refreshLoyaltySync();
      notify({ tone: "success", title: "Failed events queued", message: `${count} failed event${count === 1 ? "" : "s"} moved back to pending.` });
    } finally {
      setLoyaltyBusy(false);
    }
  };

  const saveLoyaltyRules = async () => {
    await Promise.all([
      setSetting("loyalty.punches_required", loyaltyRules.punchesRequired),
      setSetting("loyalty.referral_reward_amount", loyaltyRules.referralRewardAmount),
      setSetting("loyalty.coupon_expiration_days", loyaltyRules.couponExpirationDays)
    ]);
    notify({ tone: "success", title: "Loyalty rules saved", message: "New completions will use these local rules." });
  };

  const previewOrders = async () => {
    if (!ordersFile) return;
    if (!isDesktopDatabaseAvailable()) {
      const message = getElectronBridgeDebug().userAgent.includes("Electron")
        ? "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences."
        : "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev.";
      notify({ tone: "error", title: "SQLite bridge missing", message });
      return;
    }
    try {
      setOrdersPreview(await previewDroptopOrders(ordersFile.text));
      notify({ tone: "success", title: "Orders preview ready", message: ordersFile.name });
    } catch (error) {
      notify({ tone: "error", title: "Orders preview failed", message: error instanceof Error ? error.message : "Unable to parse orders CSV." });
    }
  };

  const runOrdersImport = async () => {
    if (!ordersFile) return;
    if (!isDesktopDatabaseAvailable()) {
      notify({ tone: "error", title: "SQLite bridge missing", message: "Electron SQLite is not connected." });
      return;
    }
    setImporting(true);
    try {
      const result = await importDroptopOrders(ordersFile.text, ordersFile.name);
      setOrdersResult(result);
      setImportHistory(await listImportBatches());
      notify({ tone: "success", title: "Orders imported", message: `${result.imported} imported, ${result.skipped} skipped.` });
    } catch (error) {
      notify({ tone: "error", title: "Orders import failed", message: error instanceof Error ? error.message : "Unable to import orders." });
    } finally {
      setImporting(false);
    }
  };

  const previewInventory = async () => {
    if (!inventoryFile) return;
    if (!isDesktopDatabaseAvailable()) {
      const message = getElectronBridgeDebug().userAgent.includes("Electron")
        ? "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences."
        : "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev.";
      notify({ tone: "error", title: "SQLite bridge missing", message });
      return;
    }
    try {
      setInventoryPreview(await previewDroptopInventory(inventoryFile.text));
      notify({ tone: "success", title: "Inventory preview ready", message: inventoryFile.name });
    } catch (error) {
      notify({ tone: "error", title: "Inventory preview failed", message: error instanceof Error ? error.message : "Unable to parse inventory CSV." });
    }
  };

  const runInventoryImport = async () => {
    if (!inventoryFile) return;
    if (!isDesktopDatabaseAvailable()) {
      notify({ tone: "error", title: "SQLite bridge missing", message: "Electron SQLite is not connected." });
      return;
    }
    setImporting(true);
    try {
      const result = await importDroptopInventory(inventoryFile.text, inventoryFile.name);
      setInventoryResult(result);
      setImportHistory(await listImportBatches());
      notify({ tone: "success", title: "Inventory imported", message: `${result.inventoryItemsCreated} created, ${result.inventoryItemsUpdated} updated.` });
    } catch (error) {
      notify({ tone: "error", title: "Inventory import failed", message: error instanceof Error ? error.message : "Unable to import inventory." });
    } finally {
      setImporting(false);
    }
  };

  const previewPackages = async () => {
    if (!packageProfileFile) return;
    if (!isDesktopDatabaseAvailable()) {
      notify({ tone: "error", title: "SQLite bridge missing", message: "Electron SQLite is not connected." });
      return;
    }
    try {
      setPackageImportPreview(await previewDroptopPackages(packageProfileFile.text, packageAccessibilityFile?.text));
      notify({ tone: "success", title: "Package preview ready", message: packageProfileFile.name });
    } catch (error) {
      notify({ tone: "error", title: "Package preview failed", message: error instanceof Error ? error.message : "Unable to parse package CSV." });
    }
  };

  const runPackagesImport = async () => {
    if (!packageProfileFile) return;
    if (!isDesktopDatabaseAvailable()) {
      notify({ tone: "error", title: "SQLite bridge missing", message: "Electron SQLite is not connected." });
      return;
    }
    setImporting(true);
    try {
      const result = await importDroptopPackages(packageProfileFile.text, packageAccessibilityFile?.text ?? null, packageProfileFile.name);
      setPackageImportResult(result);
      await reloadPackages();
      setImportHistory(await listImportBatches());
      notify({ tone: "success", title: "Packages imported", message: `${result.packagesCreated} created, ${result.packagesUpdated} updated.` });
    } catch (error) {
      notify({ tone: "error", title: "Package import failed", message: error instanceof Error ? error.message : "Unable to import packages." });
    } finally {
      setImporting(false);
    }
  };

  const filteredPackages = packages.filter((servicePackage) => {
    const query = packageSearch.trim().toLowerCase();
    const haystack = `${servicePackage.name} ${servicePackage.oil_brand ?? ""} ${servicePackage.oil_type ?? ""} ${servicePackage.package_group_name ?? ""} ${servicePackage.external_id ?? ""}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesFilter = packageFilter === "all" || (packageFilter === "active" ? Boolean(servicePackage.active) : !servicePackage.active);
    const category = getPackageCategory(servicePackage);
    const matchesCategory = packageCategoryFilter === "all" || category === packageCategoryFilter;
    return matchesSearch && matchesFilter && matchesCategory;
  });
  const groupedPackages = useMemo(() => groupPackagesByCategory(filteredPackages), [filteredPackages]);
  const packageSearchActive = Boolean(packageSearch.trim());
  const packagePricingValidation = validateCriticalDroptopPackagePrices(packages);
  const togglePackageCategory = (category: PackageCategory) => {
    setExpandedPackageCategories((current) => ({ ...current, [category]: !current[category] }));
  };

  return (
    <section className="space-y-5">
      <PageHeader theme="slate" title="Settings" subtitle="Configure shop info, services, pricing, integrations, and database tools." />
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-1 rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-1.5">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`min-h-9 whitespace-nowrap rounded-[var(--pos-radius-md)] px-3.5 text-sm font-bold transition ${activeTab === tab ? "bg-[var(--pos-blue)] text-white shadow-sm" : "text-[var(--pos-muted)] hover:bg-[var(--pos-card)] hover:text-[var(--pos-text)]"}`}>{tab}</button>
          ))}
        </div>
      </div>
      {activeTab === "Business Profile" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">Business Profile</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Local shop identity used throughout the POS, invoices, receipts, and stickers.</p>
              </div>
              <Badge tone="blue">Local Config</Badge>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Input label="Business name" value={businessProfile.business_name} onChange={(event) => setBusinessProfile({ ...businessProfile, business_name: event.target.value })} />
              <Input label="Legal name" value={businessProfile.legal_name} onChange={(event) => setBusinessProfile({ ...businessProfile, legal_name: event.target.value })} />
              <Input label="Location name" value={businessProfile.location_name} onChange={(event) => setBusinessProfile({ ...businessProfile, location_name: event.target.value })} />
              <Input label="Address line 1" value={businessProfile.address_line_1} onChange={(event) => setBusinessProfile({ ...businessProfile, address_line_1: event.target.value })} />
              <Input label="Address line 2" value={businessProfile.address_line_2} onChange={(event) => setBusinessProfile({ ...businessProfile, address_line_2: event.target.value })} />
              <Input label="City" value={businessProfile.city} onChange={(event) => setBusinessProfile({ ...businessProfile, city: event.target.value })} />
              <Input label="State" value={businessProfile.state} onChange={(event) => setBusinessProfile({ ...businessProfile, state: event.target.value })} />
              <Input label="ZIP" value={businessProfile.zip} onChange={(event) => setBusinessProfile({ ...businessProfile, zip: event.target.value })} />
              <Input label="Phone" value={businessProfile.phone} onChange={(event) => setBusinessProfile({ ...businessProfile, phone: event.target.value })} />
              <Input label="Email" value={businessProfile.email} onChange={(event) => setBusinessProfile({ ...businessProfile, email: event.target.value })} />
              <Input label="Website" value={businessProfile.website} onChange={(event) => setBusinessProfile({ ...businessProfile, website: event.target.value })} />
              <Input label="Tax ID" value={businessProfile.tax_id} onChange={(event) => setBusinessProfile({ ...businessProfile, tax_id: event.target.value })} />
              <Input label="Timezone" value={businessProfile.timezone} onChange={(event) => setBusinessProfile({ ...businessProfile, timezone: event.target.value })} />
              <Input label="Currency" value={businessProfile.currency} onChange={(event) => setBusinessProfile({ ...businessProfile, currency: event.target.value })} />
              <Input label="Sales Tax Rate" type="number" step="0.01" value={businessProfile.default_tax_rate} helperText="Enter percentage. Example: 7 for 7%." onChange={(event) => setBusinessProfile({ ...businessProfile, default_tax_rate: event.target.value })} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Input label="Invoice footer" value={businessProfile.invoice_footer} onChange={(event) => setBusinessProfile({ ...businessProfile, invoice_footer: event.target.value })} />
              <Input label="Receipt footer" value={businessProfile.receipt_footer} onChange={(event) => setBusinessProfile({ ...businessProfile, receipt_footer: event.target.value })} />
              <Input label="Sticker footer" value={businessProfile.sticker_footer} onChange={(event) => setBusinessProfile({ ...businessProfile, sticker_footer: event.target.value })} />
              <Input label="Coupon disclaimer" value={businessProfile.coupon_disclaimer} onChange={(event) => setBusinessProfile({ ...businessProfile, coupon_disclaimer: event.target.value })} />
              <Input label="Reward disclaimer" value={businessProfile.reward_disclaimer} onChange={(event) => setBusinessProfile({ ...businessProfile, reward_disclaimer: event.target.value })} />
              <Input label="Support email" value={businessProfile.support_email} onChange={(event) => setBusinessProfile({ ...businessProfile, support_email: event.target.value })} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => void saveBusinessProfileSettings()}>Save Business Profile</Button>
              <Button variant="secondary" onClick={() => void resetFlynnDefaults()}>Reset to Flynn&apos;s Default</Button>
            </div>
          </Card>
        </div>
      ) : null}
      {activeTab === "Tax" || activeTab === "Database" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_280px_120px] items-center gap-4 border-b border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--pos-muted)]">
            <span>Operation</span>
            <span>Address</span>
            <span>Status</span>
          </div>
          <div className="grid grid-cols-[1fr_280px_120px] items-center gap-4 px-5 py-4 text-sm">
            <div>
              <div className="font-bold text-[var(--pos-text)]">{shop.name}</div>
              <div className="text-[var(--pos-muted)]">Local database: {status?.databaseReady ? "Ready" : "Loading"}</div>
            </div>
            <div className="text-[var(--pos-muted)]">{shop.address}</div>
            <div><Badge tone="green">Active</Badge></div>
          </div>
          <div className="border-t border-[var(--pos-border)] p-5">
            <h3 className="font-bold text-[var(--pos-text)]">Operation Info</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Input label="Shop name" value={shop.name} onChange={(event) => setShop({ ...shop, name: event.target.value })} />
              <Input label="Address" value={shop.address} onChange={(event) => setShop({ ...shop, address: event.target.value })} />
              <Input label="Phone" value={shop.phone} onChange={(event) => setShop({ ...shop, phone: event.target.value })} />
            </div>
            <Button className="mt-3" onClick={saveShop}>Save Operation</Button>
          </div>
          <div className="border-t border-[var(--pos-border)] p-5">
            <h3 className="font-bold text-[var(--pos-text)]">Local Pricing</h3>
            <div className="mt-3 flex max-w-md items-end gap-3">
              <Input label="Tax rate percent" type="number" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} helperText="Example: enter 7.8 for 7.8%." />
              <Button onClick={saveTaxRate}>Save</Button>
            </div>
            <div className="mt-4 text-sm text-[var(--pos-muted)]">Database: {status?.databasePath ?? "Electron userData path"} · Pending sync: {status?.syncQueueCount ?? 0}</div>
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={checkingHealth} onClick={checkDatabase}>{checkingHealth ? "Checking..." : "Run Database Check"}</Button><Button variant="secondary" disabled={diagnosticsBusy} onClick={() => void exportDiagnosticBundle()}>{diagnosticsBusy ? "Exporting..." : "Export Diagnostics"}</Button></div>
            {health ? (
              <div className="mt-4 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm">
                <div className="flex flex-wrap gap-3">
                  <Badge tone={health.errors.length ? "red" : health.warnings.length ? "yellow" : "green"}>{health.errors.length ? "Errors" : health.warnings.length ? "Warnings" : "Passed"}</Badge>
                  <span>Customers: <strong>{health.counts.customers}</strong></span>
                  <span>Vehicles: <strong>{health.counts.vehicles}</strong></span>
                  <span>Tickets: <strong>{health.counts.tickets}</strong></span>
                  <span>Payments: <strong>{health.counts.payments}</strong></span>
                  <span>Service history: <strong>{health.counts.serviceHistory}</strong></span>
                  <span>Inventory: <strong>{health.counts.inventory}</strong></span>
                  <span>Completed tickets: <strong>{health.counts.completedTickets}</strong></span>
                  <span>Coupons: <strong>{health.counts.coupons}</strong></span>
                  <span>Punch cards: <strong>{health.counts.punchCards}</strong></span>
                  <span>Imported tickets: <strong>{health.counts.importedTickets}</strong></span>
                  <span>Imported customers: <strong>{health.counts.importedCustomers}</strong></span>
                  <span>Imported vehicles: <strong>{health.counts.importedVehicles}</strong></span>
                  <span>Imported inventory: <strong>{health.counts.importedInventory}</strong></span>
                </div>
                {health.errors.length ? <div className="mt-3 space-y-1 text-red-700">{health.errors.map((item) => <div key={item}>{item}</div>)}</div> : null}
                {health.warnings.length ? <div className="mt-3 space-y-1 text-amber-700">{health.warnings.map((item) => <div key={item}>{item}</div>)}</div> : null}
                {!health.errors.length && !health.warnings.length ? <div className="mt-3 text-green-700">Core tables, columns, imported IDs, payments, and service-history links look healthy.</div> : null}
              </div>
            ) : null}
          </div>
          {activeTab === "Database" ? (
            <div className="space-y-5 border-t border-[var(--pos-border)] p-5">
              <div>
                <h3 className="font-bold text-[var(--pos-text)]">Database & App Data</h3>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3"><span className="block text-xs font-bold uppercase text-[var(--pos-muted)]">SQLite database path</span><span className="break-all text-[var(--pos-text)]">{appPaths?.databasePath ?? status?.databasePath ?? "Open in Electron to view path."}</span></div>
                  <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3"><span className="block text-xs font-bold uppercase text-[var(--pos-muted)]">App data folder</span><span className="break-all text-[var(--pos-text)]">{appPaths?.userDataPath ?? "Open in Electron to view path."}</span></div>
                  <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3"><span className="block text-xs font-bold uppercase text-[var(--pos-muted)]">Version / Runtime</span><span className="text-[var(--pos-text)]">App {platformInfo?.appVersion ?? "-"} · Electron {platformInfo?.electronVersion ?? "-"} · Node {platformInfo?.nodeVersion ?? "-"}</span></div>
                  <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3"><span className="block text-xs font-bold uppercase text-[var(--pos-muted)]">Platform</span><span className="text-[var(--pos-text)]">{platformInfo ? `${platformInfo.platform} ${platformInfo.arch}` : "-"}</span></div>
                  <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3"><span className="block text-xs font-bold uppercase text-[var(--pos-muted)]">Last backup</span><span className="text-[var(--pos-text)]">{lastBackup ? `${new Date(lastBackup.created_at).toLocaleString()} · ${lastBackup.file_name}` : "No successful backup recorded."}</span></div>
                  <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3"><span className="block text-xs font-bold uppercase text-[var(--pos-muted)]">Database size</span><span className="text-[var(--pos-text)]">{lastBackup?.database_size_bytes ? `${(lastBackup.database_size_bytes / 1024 / 1024).toFixed(2)} MB at last backup` : "Available after first backup."}</span></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void createBackup()} disabled={backupBusy}>{backupBusy ? "Creating..." : "Create Backup"}</Button>
                  <Button variant="secondary" onClick={() => void openAppDataFolder().catch((error) => notify({ tone: "error", title: "Could not open folder", message: error instanceof Error ? error.message : "Open failed." }))}>Open App Data Folder</Button>
                  <Button variant="secondary" onClick={() => void copyDatabasePath()}>Copy Database Path</Button>
                  <Button variant="secondary" onClick={() => void copyDiagnosticInfo()}>Copy Diagnostic Info</Button>
                </div>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <h4 className="font-bold text-green-900">Backup History</h4>
                <div className="mt-3 divide-y divide-green-100 text-sm">
                  {backupHistory.map((backup) => (
                    <div key={backup.id} className="grid gap-2 py-2 md:grid-cols-[140px_1fr_120px]">
                      <Badge tone={backup.status === "created" ? "green" : backup.status === "failed" ? "red" : "blue"}>{backup.status}</Badge>
                      <span className="break-all text-green-950">{backup.file_name}<span className="block text-xs text-green-700">{new Date(backup.created_at).toLocaleString()}</span></span>
                      <span className="text-green-800">{backup.file_size_bytes ? `${(backup.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : "-"}</span>
                    </div>
                  ))}
                  {!backupHistory.length ? <div className="py-2 text-green-800">No backups recorded yet.</div> : null}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-bold text-[var(--pos-text)]">Recent Local Errors</h4>
                  <Button size="sm" variant="secondary" onClick={() => void clearResolvedLocalErrors().then(refreshDatabaseTools)}>Clear Resolved</Button>
                </div>
                <div className="mt-3 divide-y divide-[var(--pos-border)] text-sm">
                  {localErrors.map((entry) => (
                    <div key={entry.id} className="grid gap-2 py-2 md:grid-cols-[160px_1fr_auto]">
                      <span className="font-semibold text-[var(--pos-text)]">{entry.source}<span className="block text-xs text-[var(--pos-muted)]">{new Date(entry.created_at).toLocaleString()}</span></span>
                      <span className="text-[var(--pos-text)]">{entry.message}</span>
                      <Button size="sm" variant="secondary" onClick={() => void markLocalErrorResolved(entry.id).then(refreshDatabaseTools)}>Resolve</Button>
                    </div>
                  ))}
                  {!localErrors.length ? <div className="py-2 text-[var(--pos-muted)]">No unresolved local errors.</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
      {activeTab === "Printing" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">Printing</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Preview-first printing for window stickers, invoices, and receipts.</p>
              </div>
              <Badge tone="blue">System Dialog Recommended</Badge>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <TouchSelect label="Default print mode" value={printSettings.default_print_mode} onChange={(value) => setPrintSettings({ ...printSettings, default_print_mode: value as PrintSettings["default_print_mode"] })} options={[{ value: "preview_only", label: "Preview only" }, { value: "system_dialog", label: "System dialog" }]} />
              <Input label="Invoice template" value={printSettings.default_invoice_template} onChange={(event) => setPrintSettings({ ...printSettings, default_invoice_template: event.target.value })} />
              <Input label="Receipt template" value={printSettings.default_receipt_template} onChange={(event) => setPrintSettings({ ...printSettings, default_receipt_template: event.target.value })} />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-[var(--pos-text)]">Window Sticker / Godex RT200i</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Input label="Printer model" value={printSettings.sticker_printer_model} onChange={(event) => setPrintSettings({ ...printSettings, sticker_printer_model: event.target.value })} />
              <TouchSelect label="Language" value={printSettings.sticker_printer_language} onChange={(value) => setPrintSettings({ ...printSettings, sticker_printer_language: value as PrintSettings["sticker_printer_language"] })} options={["EZPL", "GEPL", "GZPL"].map((value) => ({ value, label: value }))} />
              <Input label="Width inches" type="number" step="0.0001" value={String(printSettings.sticker_width_inches)} onChange={(event) => setPrintSettings({ ...printSettings, sticker_width_inches: Number(event.target.value) || defaultPrintSettings.sticker_width_inches })} />
              <Input label="Height inches" type="number" step="0.01" value={String(printSettings.sticker_height_inches)} onChange={(event) => setPrintSettings({ ...printSettings, sticker_height_inches: Number(event.target.value) || defaultPrintSettings.sticker_height_inches })} />
              <Input label="DPI" type="number" value={String(printSettings.sticker_dpi)} onChange={(event) => setPrintSettings({ ...printSettings, sticker_dpi: Number(event.target.value) || defaultPrintSettings.sticker_dpi })} />
              <Input label="Next service miles" type="number" value={String(printSettings.next_service_miles)} onChange={(event) => setPrintSettings({ ...printSettings, next_service_miles: Number(event.target.value) || defaultPrintSettings.next_service_miles })} />
              <Input label="Next service months" type="number" value={String(printSettings.next_service_months)} onChange={(event) => setPrintSettings({ ...printSettings, next_service_months: Number(event.target.value) || defaultPrintSettings.next_service_months })} />
              <Input label="Sticker template" value={printSettings.default_sticker_template} onChange={(event) => setPrintSettings({ ...printSettings, default_sticker_template: event.target.value })} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {([
                ["show_vin_last8", "VIN last 8"],
                ["show_plate", "Plate"],
                ["show_filter", "Filter"],
                ["show_quarts", "Quarts"],
                ["show_shop_phone", "Shop phone"]
              ] as const).map(([key, label]) => (
                <label key={key} className="flex min-h-12 items-center gap-2 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-sm font-semibold text-[var(--pos-text)]">
                  <input type="checkbox" checked={printSettings[key]} onChange={(event) => setPrintSettings({ ...printSettings, [key]: event.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-[var(--pos-text)]">Invoice & Receipt</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="Invoice footer" value={printSettings.invoice_footer} onChange={(event) => setPrintSettings({ ...printSettings, invoice_footer: event.target.value })} />
              <Input label="Receipt footer" value={printSettings.receipt_footer} onChange={(event) => setPrintSettings({ ...printSettings, receipt_footer: event.target.value })} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {([
                ["invoice_show_logo", "Invoice logo"],
                ["invoice_show_rewards", "Invoice rewards"],
                ["invoice_show_disclaimer", "Invoice disclaimer"],
                ["receipt_show_vehicle", "Receipt vehicle"],
                ["receipt_show_rewards", "Receipt rewards"]
              ] as const).map(([key, label]) => (
                <label key={key} className="flex min-h-12 items-center gap-2 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-sm font-semibold text-[var(--pos-text)]">
                  <input type="checkbox" checked={printSettings[key]} onChange={(event) => setPrintSettings({ ...printSettings, [key]: event.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => void savePrinting()}>Save Printing Settings</Button>
            </div>
          </Card>
        </div>
      ) : null}
      {activeTab === "Hardware" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">Barcode / VIN Scanner</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">USB scanners work as keyboard input. Camera VIN scanning is optional and can use barcode detection first, then OCR text reading when the barcode will not decode.</p>
              </div>
              <Button onClick={() => setHardwareScannerOpen(true)}>Test Camera VIN Scanner</Button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
                <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">USB Scanner</div>
                <div className="mt-1 text-lg font-black text-[var(--pos-text)]">Keyboard Input</div>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Scan into any focused VIN/product field and press Enter.</p>
              </div>
              <div className="rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
                <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Camera Scanner</div>
                <div className="mt-1 text-lg font-black text-[var(--pos-text)]">Barcode + OCR</div>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Shows camera, engine, raw barcode, OCR text, VIN candidate, and validation status.</p>
              </div>
              <div className="rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
                <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">VIN Barcode Test</div>
                <div className="mt-1 font-mono text-lg font-black text-[var(--pos-text)]">1HGCM82633A004352</div>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Use this VIN as readable text or with a printed Code 39/Code 128 barcode to test scanning.</p>
              </div>
            </div>
            {hardwareScannerResult ? (
              <div className="mt-5 rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-white p-4 text-sm">
                <div className="font-black text-[var(--pos-text)]">Last camera scanner test</div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <span>VIN: <strong>{hardwareScannerResult.vin}</strong></span>
                  <span>Engine: <strong>{hardwareScannerResult.engine}</strong></span>
                  <span>Attempts: <strong>{hardwareScannerResult.attempts}</strong></span>
                  <span>Camera: <strong>{hardwareScannerResult.cameraLabel ?? "Default"}</strong></span>
                </div>
                {hardwareScannerResult.rawValue ? <div className="mt-2 break-all text-[var(--pos-muted)]">Raw barcode: {hardwareScannerResult.rawValue}</div> : null}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
      {activeTab === "Staff" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-xl font-bold text-[var(--pos-text)]">Employees</h3>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Local employee records and roles. PINs are hashed locally.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Input label="First name" value={employeeForm.first_name} onChange={(event) => setEmployeeForm({ ...employeeForm, first_name: event.target.value })} />
              <Input label="Last name" value={employeeForm.last_name} onChange={(event) => setEmployeeForm({ ...employeeForm, last_name: event.target.value })} />
              <Input label="Display name" value={employeeForm.display_name} onChange={(event) => setEmployeeForm({ ...employeeForm, display_name: event.target.value })} />
              <TouchSelect label="Role" value={employeeForm.role} onChange={(value) => setEmployeeForm({ ...employeeForm, role: value as EmployeeRole })} options={[{ value: "owner", label: "Owner" }, { value: "manager", label: "Manager" }, { value: "technician", label: "Technician" }, { value: "cashier", label: "Cashier" }]} />
              <Input label="Email" value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} />
              <Input label="Phone" value={employeeForm.phone} onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })} />
              <Input label="Hourly rate" type="number" value={employeeForm.hourly_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, hourly_rate: event.target.value })} />
              <Input label="New PIN" type="password" value={employeeForm.pin} onChange={(event) => setEmployeeForm({ ...employeeForm, pin: event.target.value })} helperText={employeeForm.id ? "Leave blank to keep existing PIN." : "Optional for now."} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex min-h-12 items-center gap-2 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={employeeForm.active} onChange={(event) => setEmployeeForm({ ...employeeForm, active: event.target.checked })} />
                Active
              </label>
              <Button onClick={() => void saveEmployee()}>{employeeForm.id ? "Save Employee" : "Add Employee"}</Button>
              {employeeForm.id ? <Button variant="secondary" onClick={() => setEmployeeForm({ id: "", first_name: "", last_name: "", display_name: "", email: "", phone: "", role: "technician", hourly_rate: "", active: true, pin: "" })}>Cancel Edit</Button> : null}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_100px_120px_auto] gap-3 border-b border-[var(--pos-border)] px-4 py-3 text-xs font-bold uppercase text-[var(--pos-muted)]">
              <span>Employee</span><span>Role</span><span>Status</span><span>Rate</span><span>Actions</span>
            </div>
            {employees.map((employee) => (
              <div key={employee.id} className="grid grid-cols-[1fr_120px_100px_120px_auto] gap-3 border-b border-[var(--pos-border)] px-4 py-3 text-sm last:border-0">
                <span className="font-semibold text-[var(--pos-text)]">{employee.display_name}<span className="block text-xs text-[var(--pos-muted)]">{employee.email ?? employee.phone ?? "No contact"}</span></span>
                <Badge tone={employee.role === "owner" ? "blue" : employee.role === "manager" ? "purple" : "slate"}>{employee.role}</Badge>
                <Badge tone={employee.active ? "green" : "slate"}>{employee.active ? "Active" : "Inactive"}</Badge>
                <span className="text-[var(--pos-muted)]">{employee.hourly_rate ? `$${employee.hourly_rate}/hr` : "-"}</span>
                <Button size="sm" variant="secondary" onClick={() => editEmployee(employee)}>Edit</Button>
              </div>
            ))}
          </Card>
        </div>
      ) : null}
      {activeTab === "Audit Log" ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-[var(--pos-text)]">Audit Log</h3>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Important local POS actions by employee, ticket, inventory, payments, settings, and closeout.</p>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search audit log..." value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} />
              <Button onClick={() => void refreshAudit()}>Search</Button>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--pos-border)]">
            {auditLogs.map((entry) => (
              <details key={entry.id} className="border-b border-[var(--pos-border)] p-3 text-sm last:border-0">
                <summary className="cursor-pointer text-[var(--pos-text)]">
                  <strong>{entry.action}</strong> · {entry.summary} · <span className="text-[var(--pos-muted)]">{entry.actor_name ?? "System"} · {new Date(entry.created_at).toLocaleString()}</span>
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto rounded bg-[var(--pos-bg)] p-3 text-xs text-[var(--pos-muted)]">{JSON.stringify({ entity: `${entry.entity_type}:${entry.entity_id ?? ""}`, before: entry.before_json ? JSON.parse(entry.before_json) : null, after: entry.after_json ? JSON.parse(entry.after_json) : null, metadata: entry.metadata_json ? JSON.parse(entry.metadata_json) : null }, null, 2)}</pre>
              </details>
            ))}
            {!auditLogs.length ? <div className="p-4 text-sm text-[var(--pos-muted)]">No audit log entries yet.</div> : null}
          </div>
        </Card>
      ) : null}
      {activeTab === "Daily Closeout" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">Daily Closeout</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Close local business-day sales and cash totals.</p>
              </div>
              <div className="flex gap-2">
                <Input label="Business date" type="date" value={closeoutDate} onChange={(event) => setCloseoutDate(event.target.value)} />
                <Button className="mt-7" onClick={() => void loadCloseout(closeoutDate)}>Load</Button>
              </div>
            </div>
            {closeoutSummary ? (
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                {[["Completed Tickets", closeoutSummary.completedTicketCount], ["Gross Sales", `$${closeoutSummary.grossSales.toFixed(2)}`], ["Tax", `$${closeoutSummary.taxCollected.toFixed(2)}`], ["Cash Expected", `$${closeoutSummary.cashTotal.toFixed(2)}`], ["Card", `$${closeoutSummary.cardTotal.toFixed(2)}`], ["Check", `$${closeoutSummary.checkTotal.toFixed(2)}`], ["Other", `$${closeoutSummary.otherTotal.toFixed(2)}`], ["Open/Waiting", `${closeoutSummary.openTicketCount}/${closeoutSummary.waitingPaymentCount}`]].map(([label, value]) => (
                  <div key={label} className="rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
                    <div className="text-xs font-bold uppercase text-[var(--pos-muted)]">{label}</div>
                    <div className="mt-2 text-2xl font-black text-[var(--pos-text)]">{value}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr_auto_auto]">
              <Input label="Cash counted" type="number" value={cashCounted} onChange={(event) => setCashCounted(event.target.value)} />
              <Input label="Notes" value={closeoutNotes} onChange={(event) => setCloseoutNotes(event.target.value)} />
              <Button className="mt-7" onClick={() => void closeDay()}>Close Day</Button>
              <Button className="mt-7" variant="secondary" disabled={!closeout || closeout.status !== "closed"} onClick={() => closeout && window.confirm("Reopen this business day?") && void reopenBusinessDay(closeout.id).then(() => loadCloseout(closeoutDate))}>Reopen</Button>
            </div>
            {closeout ? <div className="mt-4 text-sm text-[var(--pos-muted)]">Status: <Badge tone={closeout.status === "closed" ? "green" : "yellow"}>{closeout.status}</Badge> Cash over/short: <strong>${Number(closeout.cash_over_short ?? 0).toFixed(2)}</strong></div> : null}
          </Card>
          <Card className="p-5">
            <h3 className="text-lg font-bold text-[var(--pos-text)]">Recent Closeouts</h3>
            <div className="mt-3 divide-y divide-[var(--pos-border)]">
              {closeouts.map((item) => <div key={item.id} className="grid gap-2 py-3 text-sm md:grid-cols-[140px_100px_1fr_140px]"><span className="font-semibold text-[var(--pos-text)]">{item.business_date}</span><Badge tone={item.status === "closed" ? "green" : "yellow"}>{item.status}</Badge><span className="text-[var(--pos-muted)]">Gross ${item.gross_sales.toFixed(2)} · Cash ${item.cash_total.toFixed(2)}</span><span className="text-[var(--pos-muted)]">Over/short ${Number(item.cash_over_short ?? 0).toFixed(2)}</span></div>)}
            </div>
          </Card>
        </div>
      ) : null}
      {activeTab === "Advanced" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-xl font-bold text-[var(--pos-text)]">Integration Registry</h3>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Internet integrations are opt-in. SQLite and local history remain the source of truth.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {integrations.map((integration) => (
                <div key={integration.id} className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-[var(--pos-text)]">{integration.name}</div>
                      <div className="text-xs font-semibold uppercase text-[var(--pos-muted)]">{integration.provider}</div>
                    </div>
                    <Badge tone={integration.status === "configured" ? "green" : integration.status === "error" ? "red" : "slate"}>{integration.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--pos-muted)]">{integration.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--pos-muted)]">
                    <span>{integration.isFreePublicApi ? "Free/public" : "External provider"}</span>
                    <span>{integration.requiresInternet ? "Internet" : "Offline"}</span>
                    <span>{integration.requiresApiKey ? "Key required" : "No key"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">Vehicle Info Lookup</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Local history and manual search links help employees verify oil capacity, oil type, and filters. Web results are never saved without employee confirmation.</p>
                <div className="mt-3 grid gap-2 text-sm text-[var(--pos-muted)] md:grid-cols-3">
                  <span>Local History: <strong>Enabled</strong></span>
                  <span>Manual Search Links: <strong>Enabled</strong></span>
                  <span>Google JSON API: <strong>{vehicleInfoSearchStatus?.status.replace("_", " ") ?? "disabled"}</strong></span>
                </div>
                <p className="mt-2 text-sm text-[var(--pos-muted)]">{vehicleInfoSearchStatus?.message ?? "Manual search links are available."}</p>
                <p className="mt-2 text-xs text-[var(--pos-muted)]">Use environment variables VITE_GOOGLE_SEARCH_API_KEY and VITE_GOOGLE_SEARCH_CX, or masked app settings later. No key is committed.</p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 py-2 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={vehicleInfoSearchEnabled} onChange={(event) => void toggleVehicleInfoSearch(event.target.checked)} />
                Enable Google Vehicle Search
              </label>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">NHTSA vPIC VIN Decoder</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Uses the public NHTSA vPIC VIN decoder for year, make, model, engine, body, and manufacturer data.</p>
                <div className="mt-3 grid gap-2 text-sm text-[var(--pos-muted)] md:grid-cols-4">
                  <span>Provider: <strong>{vinSettings.provider}</strong></span>
                  <span>Status: <strong>{vinDecoderEnabled ? "Enabled" : "Disabled"}</strong></span>
                  <span>Timeout: <strong>{vinSettings.timeoutMs}ms</strong></span>
                  <span>Cache: <strong>{vinSettings.cacheDays} days</strong></span>
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 py-2 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={vinDecoderEnabled} onChange={(event) => void toggleVinDecoder(event.target.checked)} />
                Enable VIN Decoder
              </label>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <Input label="Test VIN" value={vinTestInput} onChange={(event) => setVinTestInput(event.target.value.toUpperCase())} placeholder="17-character VIN" />
              <Button className="mt-7" disabled={!vinDecoderEnabled || vinTesting} onClick={testVinDecode}>{vinTesting ? "Decoding..." : "Test Decode"}</Button>
            </div>
            {vinTestResult ? (
              <div className="mt-4 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm">
                <div className="font-bold text-[var(--pos-text)]">{vinTestResult.message}</div>
                {vinTestResult.data ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <span>{vinTestResult.data.year ?? "-"} {vinTestResult.data.make ?? ""} {vinTestResult.data.model ?? ""}</span>
                    <span>Engine: {vinTestResult.data.engineModel ?? vinTestResult.data.engineDisplacementL ?? "-"}</span>
                    <span>Source: {vinTestResult.data.source} / {vinTestResult.data.confidence}</span>
                  </div>
                ) : null}
                {vinTestResult.data?.raw ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-semibold text-[var(--pos-text)]">Raw response</summary>
                    <pre className="mt-2 max-h-56 overflow-auto rounded bg-white p-3 text-xs">{JSON.stringify(vinTestResult.data.raw, null, 2)}</pre>
                  </details>
                ) : null}
              </div>
            ) : null}
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">EPA FuelEconomy.gov</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Optional public vehicle metadata and MPG matching by year, make, and model. Results are cached locally.</p>
                <p className="mt-2 text-sm text-[var(--pos-muted)]">Cache entries: <strong>{epaCacheCount}</strong></p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 py-2 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={epaEnabled} onChange={(event) => void toggleEpa(event.target.checked)} />
                Enable EPA Lookup
              </label>
            </div>
            {epaEnabled ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-[120px_1fr_1fr_auto]">
                  <Input label="Year" value={epaTest.year} onChange={(event) => setEpaTest({ ...epaTest, year: event.target.value })} />
                  <Input label="Make" value={epaTest.make} onChange={(event) => setEpaTest({ ...epaTest, make: event.target.value })} />
                  <Input label="Model" value={epaTest.model} onChange={(event) => setEpaTest({ ...epaTest, model: event.target.value })} />
                  <Button className="mt-7" disabled={epaTesting} onClick={() => void testEpa()}>{epaTesting ? "Searching..." : "Test EPA Match"}</Button>
                </div>
                {epaResults.length ? (
                  <div className="mt-4 divide-y divide-[var(--pos-border)] rounded-lg border border-[var(--pos-border)] text-sm">
                    {epaResults.slice(0, 5).map((item) => (
                      <div key={item.epaVehicleId} className="grid gap-2 p-3 md:grid-cols-[1fr_160px_140px]">
                        <span className="font-semibold text-[var(--pos-text)]">{item.year} {item.make} {item.model} · {item.transmission ?? item.trim ?? "Option"}</span>
                        <span className="text-[var(--pos-muted)]">{item.fuelType ?? "-"} · {item.drive ?? "-"}</span>
                        <span className="text-[var(--pos-muted)]">MPG {item.mpgCombined ?? "-"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">NHTSA Recall Lookup</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Optional public recall campaign lookup. Manual NHTSA links are used when live lookup is not enabled.</p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 py-2 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={recallEnabled} onChange={(event) => void toggleRecalls(event.target.checked)} />
                Enable Recall Lookup
              </label>
            </div>
            {recallEnabled ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-[120px_1fr_1fr_auto]">
                  <Input label="Year" value={recallTest.year} onChange={(event) => setRecallTest({ ...recallTest, year: event.target.value })} />
                  <Input label="Make" value={recallTest.make} onChange={(event) => setRecallTest({ ...recallTest, make: event.target.value })} />
                  <Input label="Model" value={recallTest.model} onChange={(event) => setRecallTest({ ...recallTest, model: event.target.value })} />
                  <Button className="mt-7" onClick={() => void testRecalls()}>Test Recalls</Button>
                </div>
                {recallResult ? (
                  <div className="mt-4 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm text-[var(--pos-text)]">
                    <strong>{recallResult.message}</strong>
                    {recallResult.externalUrl ? <a className="ml-3 font-bold text-[var(--pos-blue)]" href={recallResult.externalUrl} target="_blank" rel="noreferrer">Open NHTSA</a> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">OpenStreetMap / Nominatim</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Optional manual geocoding for future address validation. It is rate-limited and never runs while typing.</p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 py-2 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={geocodingEnabled} onChange={(event) => void toggleGeocoding(event.target.checked)} />
                Enable Geocoding
              </label>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">{brandConfig.featureLabels.loyaltyName} App Sync</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Queues completed services, vehicles, punch cards, coupons, referrals, and check-ins for the Firebase customer app. Live Firestore writes stay off until configured.</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <Badge tone={loyaltyStatus?.enabled ? "green" : "slate"}>{loyaltyStatus?.status.replace(/_/g, " ") ?? "Disabled"}</Badge>
                  <span className="text-[var(--pos-muted)]">Provider: Firebase / Firestore</span>
                  <span className="text-[var(--pos-muted)]">Pending: <strong>{loyaltyStats?.pending ?? 0}</strong></span>
                  <span className="text-[var(--pos-muted)]">Failed: <strong>{loyaltyStats?.failed ?? 0}</strong></span>
                  <span className="text-[var(--pos-muted)]">Synced: <strong>{loyaltyStats?.synced ?? 0}</strong></span>
                </div>
                {loyaltyStats?.lastError ? <div className="mt-2 text-sm text-red-700">Last error: {loyaltyStats.lastError}</div> : null}
                {loyaltyStats?.lastAttempt ? <div className="mt-1 text-sm text-[var(--pos-muted)]">Last sync attempt: {new Date(loyaltyStats.lastAttempt).toLocaleString()}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={loyaltyBusy} onClick={() => void dryRunLoyaltySync()}>{loyaltyBusy ? "Working..." : "Dry Run Pending Sync"}</Button>
                <Button variant="secondary" disabled={loyaltyBusy || !loyaltyStats?.failed} onClick={() => void retryLoyaltyFailures()}>Retry Failed</Button>
              </div>
            </div>
            {loyaltyEvents.length ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--pos-border)]">
                {loyaltyEvents.map((event) => (
                  <div key={event.id} className="grid gap-2 border-b border-[var(--pos-border)] px-3 py-2 text-sm last:border-0 md:grid-cols-[1fr_120px_160px]">
                    <span className="font-semibold text-[var(--pos-text)]">{event.event_type} · {event.entity_type}</span>
                    <Badge tone={event.status === "failed" ? "red" : event.status === "synced" ? "green" : "slate"}>{event.status}</Badge>
                    <span className="text-[var(--pos-muted)]">{new Date(event.updated_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-[var(--pos-muted)]">No loyalty sync events yet. Completed local oil changes will enqueue events here.</p>}
          </Card>
        </div>
      ) : null}
      {activeTab === "Loyalty Rules" ? (
        <Card className="p-5">
          <h3 className="text-xl font-bold text-[var(--pos-text)]">Local Loyalty Rules</h3>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Rules are evaluated locally when tickets are finalized. Customer app sync remains queued until Firebase is configured.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input label="Punches required for free oil change" type="number" value={loyaltyRules.punchesRequired} onChange={(event) => setLoyaltyRules({ ...loyaltyRules, punchesRequired: event.target.value })} />
            <Input label="Referral reward amount" type="number" value={loyaltyRules.referralRewardAmount} onChange={(event) => setLoyaltyRules({ ...loyaltyRules, referralRewardAmount: event.target.value })} />
            <Input label="Coupon expiration days" type="number" value={loyaltyRules.couponExpirationDays} onChange={(event) => setLoyaltyRules({ ...loyaltyRules, couponExpirationDays: event.target.value })} placeholder="Optional" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void saveLoyaltyRules()}>Save Loyalty Rules</Button>
          </div>
        </Card>
      ) : null}
      {activeTab === "Import Data" ? (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-[var(--pos-text)]">Local SQLite Connection</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">
                  {bridgeDebug.databaseAvailable
                    ? "Electron SQLite connected."
                    : bridgeDebug.userAgent.includes("Electron")
                      ? "Electron window opened, but preload bridge is missing. Check preload.ts and BrowserWindow webPreferences."
                      : "Local SQLite is available in the Electron desktop app. Start with npm run electron:dev."}
                </div>
              </div>
              <Badge tone={bridgeDebug.databaseAvailable ? "green" : "red"}>{bridgeDebug.databaseAvailable ? "Connected" : "Not Connected"}</Badge>
            </div>
            {import.meta.env.DEV ? (
              <div className="mt-3 rounded-md bg-[var(--pos-panel-2)] p-3 font-mono text-xs text-[var(--pos-muted)]">
                isElectronBridgeDetected={String(bridgeDebug.isElectronBridgeDetected)} · databaseAvailable={String(bridgeDebug.databaseAvailable)} · legacyBridgeDetected={String(bridgeDebug.legacyBridgeDetected)} · userAgent={bridgeDebug.userAgent}
              </div>
            ) : null}
          </Card>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="p-5">
              <h3 className="text-lg font-bold text-[var(--pos-text)]">Import Droptop Orders CSV</h3>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Imports finalized order history, customers, vehicles, payments, and service history.</p>
              <input
                className="mt-4 block w-full rounded-md border border-[var(--pos-border)] bg-white p-3 text-sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readCsvFile(file).then((loaded) => {
                    setOrdersFile(loaded);
                    setOrdersPreview(null);
                    setOrdersResult(null);
                  });
                }}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" disabled={!ordersFile} onClick={previewOrders}>Preview Import</Button>
                <Button disabled={!ordersPreview || importing} onClick={runOrdersImport}>{importing ? "Importing..." : "Run Import"}</Button>
              </div>
              {ordersPreview ? (
                <div className="mt-5 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Total rows: <strong>{ordersPreview.totalRows}</strong></div>
                    <div>New tickets: <strong>{ordersPreview.estimatedNewTickets}</strong></div>
                    <div>Duplicate tickets skipped: <strong>{ordersPreview.estimatedSkippedDuplicateTickets}</strong></div>
                    <div>Estimated customers: <strong>{ordersPreview.estimatedNewCustomers}</strong></div>
                    <div>Estimated vehicles: <strong>{ordersPreview.estimatedNewVehicles}</strong></div>
                  </div>
                  <div className="mt-4 text-xs text-[var(--pos-muted)]">First rows: {ordersPreview.rowsPreview.map((row) => row.values["Order ID"]).filter(Boolean).join(", ") || "None"}</div>
                </div>
              ) : null}
              {ordersResult ? (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  Imported {ordersResult.imported}, skipped {ordersResult.skipped}, failed {ordersResult.failed}. Customers {ordersResult.customersCreated}, vehicles {ordersResult.vehiclesCreated}, tickets {ordersResult.ticketsCreated}, payments {ordersResult.paymentsCreated}, history {ordersResult.serviceHistoryCreated}.
                </div>
              ) : null}
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-bold text-[var(--pos-text)]">Import Droptop Inventory CSV</h3>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Imports product quantities, pricing, vendors, and oil/filter metadata.</p>
              <input
                className="mt-4 block w-full rounded-md border border-[var(--pos-border)] bg-white p-3 text-sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readCsvFile(file).then((loaded) => {
                    setInventoryFile(loaded);
                    setInventoryPreview(null);
                    setInventoryResult(null);
                  });
                }}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" disabled={!inventoryFile} onClick={previewInventory}>Preview Import</Button>
                <Button disabled={!inventoryPreview || importing} onClick={runInventoryImport}>{importing ? "Importing..." : "Run Import"}</Button>
              </div>
              {inventoryPreview ? (
                <div className="mt-5 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Total rows: <strong>{inventoryPreview.totalRows}</strong></div>
                    <div>New items: <strong>{inventoryPreview.estimatedNewInventoryItems}</strong></div>
                    <div>Updated items: <strong>{inventoryPreview.estimatedUpdatedInventoryItems}</strong></div>
                  </div>
                  <div className="mt-4 text-xs text-[var(--pos-muted)]">First rows: {inventoryPreview.rowsPreview.map((row) => row.values["Product ID"]).filter(Boolean).join(", ") || "None"}</div>
                </div>
              ) : null}
              {inventoryResult ? (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  Imported {inventoryResult.imported}, failed {inventoryResult.failed}. Created {inventoryResult.inventoryItemsCreated}, updated {inventoryResult.inventoryItemsUpdated}.
                </div>
              ) : null}
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-bold text-[var(--pos-text)]">Import Droptop Packages CSV</h3>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Updates package totals, base service amounts, disposal fees, intervals, services, and Flynn's accessibility.</p>
              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Package profiles pricing CSV</label>
              <input
                className="mt-2 block w-full rounded-md border border-[var(--pos-border)] bg-white p-3 text-sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readCsvFile(file).then((loaded) => {
                    setPackageProfileFile(loaded);
                    setPackageImportPreview(null);
                    setPackageImportResult(null);
                  });
                }}
              />
              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Accessibility CSV</label>
              <input
                className="mt-2 block w-full rounded-md border border-[var(--pos-border)] bg-white p-3 text-sm"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readCsvFile(file).then((loaded) => {
                    setPackageAccessibilityFile(loaded);
                    setPackageImportPreview(null);
                    setPackageImportResult(null);
                  });
                }}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" disabled={!packageProfileFile} onClick={previewPackages}>Preview Import</Button>
                <Button disabled={!packageImportPreview || importing} onClick={runPackagesImport}>{importing ? "Importing..." : "Run Import"}</Button>
              </div>
              {packageImportPreview ? (
                <div className="mt-5 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>Total rows: <strong>{packageImportPreview.totalRows}</strong></div>
                    <div>Accessible to Flynn's: <strong>{packageImportPreview.accessibleRows}</strong></div>
                    <div>New packages: <strong>{packageImportPreview.estimatedNewPackages}</strong></div>
                    <div>Updated packages: <strong>{packageImportPreview.estimatedUpdatedPackages}</strong></div>
                  </div>
                  <div className="mt-4 text-xs text-[var(--pos-muted)]">First rows: {packageImportPreview.rowsPreview.map((row) => row.values.Name).filter(Boolean).join(", ") || "None"}</div>
                </div>
              ) : null}
              {packageImportResult ? (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  Imported {packageImportResult.imported}, failed {packageImportResult.failed}. Created {packageImportResult.packagesCreated}, updated {packageImportResult.packagesUpdated}, accessible {packageImportResult.packagesAccessible}, duplicates hidden {packageImportResult.duplicatesDeactivated}.
                </div>
              ) : null}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-lg font-bold text-[var(--pos-text)]">Import History</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[var(--pos-muted)]">
                  <tr><th className="py-2">File</th><th>Type</th><th>Status</th><th>Imported</th><th>Skipped</th><th>Failed</th><th>Started</th></tr>
                </thead>
                <tbody>
                  {importHistory.map((batch) => (
                    <tr key={batch.id} className="cursor-pointer border-t border-[var(--pos-border)] hover:bg-[var(--pos-panel-2)]" onClick={() => void getImportHistoryEntry(batch.id).then(setSelectedHistory)}>
                      <td className="py-3 font-semibold text-[var(--pos-text)]">{batch.file_name}</td>
                      <td>{batch.import_type}</td>
                      <td>{batch.status}</td>
                      <td>{batch.rows_imported}</td>
                      <td>{batch.rows_skipped}</td>
                      <td>{batch.rows_failed}</td>
                      <td>{new Date(batch.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedHistory ? (
              <div className="mt-5 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4 text-sm">
                <div className="font-bold text-[var(--pos-text)]">{selectedHistory.file_name}</div>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-white p-3 text-xs text-[var(--pos-muted)]">{selectedHistory.summary_json ?? "{}"}</pre>
                {selectedHistory.errors.length ? (
                  <div className="mt-3 space-y-2">
                    {selectedHistory.errors.slice(0, 10).map((error) => (
                      <div key={error.id} className="rounded border border-red-100 bg-red-50 p-2 text-red-700">Row {error.row_number ?? "-"}: {error.message}</div>
                    ))}
                  </div>
                ) : <div className="mt-3 text-[var(--pos-muted)]">No errors recorded.</div>}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
      {activeTab === "Packages" ? (
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[var(--pos-text)]">Service Packages</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pos-muted)]">Manage categorized package pricing, included services, intervals, fees, and package availability.</p>
              </div>
              <Button onClick={() => setPackageEditor({ mode: "create", servicePackage: null })}>+ Add Package</Button>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              Package changes only affect new tickets. Existing tickets keep their saved prices.
            </div>
            {packagePricingValidation.ok ? (
              <div className="mt-4 inline-flex rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-black text-green-700">
                Pricing verified from Droptop import
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                Droptop critical price check is not complete yet. Missing or mismatched: {packagePricingValidation.failures.map((failure) => failure.name).join(", ")}
              </div>
            )}
            <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_240px_auto]">
              <Input value={packageSearch} onChange={(event) => setPackageSearch(event.target.value)} placeholder="Search packages by name, oil brand, or oil type..." />
              <TouchSelect
                value={packageCategoryFilter}
                onChange={(value) => setPackageCategoryFilter(value as "all" | PackageCategory)}
                options={[{ value: "all", label: "All Categories" }, ...PACKAGE_CATEGORY_ORDER.map((category) => ({ value: category, label: category }))]}
                searchable
              />
              <div className="flex flex-wrap gap-2">
                {(["all", "active", "inactive"] as const).map((filter) => (
                  <Button key={filter} variant={packageFilter === filter ? "primary" : "secondary"} onClick={() => setPackageFilter(filter)}>
                    {filter === "all" ? "All" : filter === "active" ? "Show Active" : "Show Inactive"}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            {PACKAGE_CATEGORY_ORDER.map((category) => {
              const categoryPackages = groupedPackages[category];
              if (packageCategoryFilter !== "all" && packageCategoryFilter !== category) return null;
              if (packageSearchActive && !categoryPackages.length) return null;
              const activeCount = categoryPackages.filter((servicePackage) => servicePackage.active).length;
              const inactiveCount = categoryPackages.length - activeCount;
              const expanded = packageSearchActive ? categoryPackages.length > 0 : Boolean(expandedPackageCategories[category]);
              return (
                <Card key={category} className="overflow-hidden">
                  <button
                    type="button"
                    className="flex min-h-[72px] w-full items-center justify-between gap-4 bg-white px-5 py-4 text-left transition hover:bg-[var(--pos-card-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]"
                    onClick={() => togglePackageCategory(category)}
                    aria-expanded={expanded}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]">
                        {expanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-tight text-[var(--pos-text)]">{category}</h3>
                        <p className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">
                          {categoryPackages.length} package{categoryPackages.length === 1 ? "" : "s"} · {activeCount} active{inactiveCount ? ` · ${inactiveCount} inactive` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="hidden rounded-full border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] px-3 py-1 text-xs font-black uppercase text-[var(--pos-muted)] sm:block">
                      {expanded ? "Collapse" : "Expand"}
                    </div>
                  </button>
                  {expanded ? (
                    <div className="border-t border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
                      {categoryPackages.length ? (
                        <div className="grid gap-4 xl:grid-cols-2">
                          {categoryPackages.map((servicePackage) => (
                            <PackageCard
                              key={servicePackage.id}
                              servicePackage={servicePackage}
                              onEdit={() => setPackageEditor({ mode: "edit", servicePackage })}
                              onDuplicate={() => void duplicateServicePackage(servicePackage)}
                              onToggleActive={() => servicePackage.active ? setPackageConfirm(servicePackage) : void togglePackageActive(servicePackage)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[var(--pos-border-strong)] bg-white p-6 text-center text-sm font-semibold text-[var(--pos-muted)]">
                          No packages in this category yet.
                        </div>
                      )}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
          {!filteredPackages.length ? (
            <Card className="p-8 text-center">
              <h3 className="text-xl font-black text-[var(--pos-text)]">No packages match this view</h3>
              <p className="mt-2 text-sm text-[var(--pos-muted)]">Clear the search, category, or active filter to see all service packages.</p>
            </Card>
          ) : null}
        </div>
      ) : null}
      {activeTab === "Services" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold text-[var(--pos-text)]">Add Catalog Item</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px_130px_100px_120px_auto]">
              <Input label="Name" value={newCatalogItem.name} onChange={(event) => setNewCatalogItem((current) => ({ ...current, name: event.target.value }))} />
              <Input label="Category" value={newCatalogItem.category} onChange={(event) => setNewCatalogItem((current) => ({ ...current, category: event.target.value }))} />
              <Input label="Base price" type="number" step="0.01" value={newCatalogItem.base_price} onChange={(event) => setNewCatalogItem((current) => ({ ...current, base_price: event.target.value }))} />
              <label className="mt-7 flex items-center gap-2 text-sm text-[var(--pos-muted)]"><input type="checkbox" checked={newCatalogItem.is_fee} onChange={(event) => setNewCatalogItem((current) => ({ ...current, is_fee: event.target.checked, is_discount: event.target.checked ? false : current.is_discount }))} /> Fee</label>
              <label className="mt-7 flex items-center gap-2 text-sm text-[var(--pos-muted)]"><input type="checkbox" checked={newCatalogItem.is_discount} onChange={(event) => setNewCatalogItem((current) => ({ ...current, is_discount: event.target.checked, is_fee: event.target.checked ? false : current.is_fee }))} /> Discount</label>
              <Button className="mt-7" onClick={addCatalogItem}>Add</Button>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="grid min-w-[980px] grid-cols-[1.4fr_140px_110px_160px_90px_90px_90px_90px_90px] gap-3 border-b border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--pos-muted)]">
              <span>Name</span><span>Category</span><span>Price</span><span>Description</span><span>Taxable</span><span>Fee</span><span>Discount</span><span>Active</span><span>Save</span>
            </div>
            {catalogItems.map((item, index) => (
              <div key={item.id} className="grid min-w-[980px] grid-cols-[1.4fr_140px_110px_160px_90px_90px_90px_90px_90px] items-center gap-3 border-b border-[var(--pos-border)] px-4 py-3 text-sm">
                <Input value={item.name} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, name: event.target.value } : catalogItem))} />
                <Input value={item.category} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, category: event.target.value } : catalogItem))} />
                <Input type="number" step="0.01" value={item.base_price} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, base_price: Number(event.target.value) || 0 } : catalogItem))} />
                <Input value={item.description ?? ""} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, description: event.target.value || null } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.taxable)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, taxable: event.target.checked ? 1 : 0 } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.is_fee)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, is_fee: event.target.checked ? 1 : 0, is_discount: event.target.checked ? 0 : catalogItem.is_discount } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.is_discount)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, is_discount: event.target.checked ? 1 : 0, is_fee: event.target.checked ? 0 : catalogItem.is_fee } : catalogItem))} />
                <input type="checkbox" checked={Boolean(item.active)} onChange={(event) => setCatalogItems((current) => current.map((catalogItem, i) => i === index ? { ...catalogItem, active: event.target.checked ? 1 : 0 } : catalogItem))} />
                <Button size="sm" onClick={() => void saveCatalogItem(item)}>Save</Button>
              </div>
            ))}
          </Card>
        </div>
      ) : null}
      {activeTab === "Theme/Branding" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--pos-text)]">Theme & Branding</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Reskin the local POS without touching customer, vehicle, ticket, payment, or inventory data.</p>
              </div>
              <BrandPreviewCard brand={brandConfig} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Input label="App name" value={brandConfig.appName} onChange={(event) => setBrandConfig({ ...brandConfig, appName: event.target.value })} />
              <Input label="Business display name" value={brandConfig.businessName} onChange={(event) => setBrandConfig({ ...brandConfig, businessName: event.target.value })} helperText="Business Profile remains the source for invoices and receipts." />
              <Input label="Logo path" value={brandConfig.logoPath ?? ""} onChange={(event) => setBrandConfig({ ...brandConfig, logoPath: event.target.value || null })} placeholder="Local image path" />
              <ThemeColorPicker label="Primary color" value={brandConfig.primaryColor} onChange={(value) => setBrandConfig({ ...brandConfig, primaryColor: value })} />
              <ThemeColorPicker label="Secondary color" value={brandConfig.secondaryColor} onChange={(value) => setBrandConfig({ ...brandConfig, secondaryColor: value })} />
              <ThemeColorPicker label="Accent color" value={brandConfig.accentColor} onChange={(value) => setBrandConfig({ ...brandConfig, accentColor: value })} />
              <ThemeColorPicker label="Background" value={brandConfig.backgroundColor} onChange={(value) => setBrandConfig({ ...brandConfig, backgroundColor: value })} />
              <ThemeColorPicker label="Panel" value={brandConfig.panelColor} onChange={(value) => setBrandConfig({ ...brandConfig, panelColor: value })} />
              <ThemeColorPicker label="Card" value={brandConfig.cardColor} onChange={(value) => setBrandConfig({ ...brandConfig, cardColor: value })} />
              <TouchSelect label="Mode" value={brandConfig.mode} onChange={(value) => setBrandConfig({ ...brandConfig, mode: value as BrandConfig["mode"] })} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
              <TouchSelect label="Density" value={brandConfig.density} onChange={(value) => setBrandConfig({ ...brandConfig, density: value as BrandConfig["density"] })} options={[{ value: "touch", label: "Touch" }, { value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
              <Input label="Font family" value={brandConfig.fontFamily} onChange={(event) => setBrandConfig({ ...brandConfig, fontFamily: event.target.value })} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => void saveBrandSettings()}>Save Branding</Button>
              <Button variant="secondary" onClick={() => void resetFlynnDefaults()}>Reset to Flynn&apos;s Default</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xl font-bold text-[var(--pos-text)]">Terminology</h3>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Rename common concepts for another quick-lube shop.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {([
                ["ticketLabel", "Ticket"],
                ["orderLabel", "Order"],
                ["customerLabel", "Customer"],
                ["vehicleLabel", "Vehicle"],
                ["bayLabel", "Bay"],
                ["packageLabel", "Package"],
                ["serviceLabel", "Service"],
                ["technicianLabel", "Technician"],
                ["couponLabel", "Coupon"],
                ["rewardLabel", "Reward"]
              ] as const).map(([key, label]) => (
                <Input key={key} label={label} value={brandConfig.terminology[key]} onChange={(event) => setBrandConfig({ ...brandConfig, terminology: { ...brandConfig.terminology, [key]: event.target.value } })} />
              ))}
              {([
                ["loyaltyName", "Loyalty name"],
                ["rewardsName", "Rewards name"],
                ["punchCardName", "Punch card name"],
                ["referralName", "Referral name"]
              ] as const).map(([key, label]) => (
                <Input key={key} label={label} value={brandConfig.featureLabels[key]} onChange={(event) => setBrandConfig({ ...brandConfig, featureLabels: { ...brandConfig.featureLabels, [key]: event.target.value } })} />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xl font-bold text-[var(--pos-text)]">Feature Flags / Modules</h3>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Core modules stay visible for this local beta. Disabled integrations remain honest until configured.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["Loyalty / Rewards", defaultFeatureFlags.enableRewards],
                ["Referrals", defaultFeatureFlags.enableReferralRewards],
                ["Coupons", defaultFeatureFlags.enableCoupons],
                ["Punch Cards", defaultFeatureFlags.enablePunchCards],
                ["Inventory", true],
                ["Employees", true],
                ["Daily Closeout", true],
                ["VIN Decoder", defaultFeatureFlags.enableVinDecodeApi],
                ["Printing", true],
                ["Customer App Sync", defaultFeatureFlags.enableFirebaseLoyaltySync]
              ].filter(([, enabled]) => Boolean(enabled)).map(([label, enabled]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3">
                  <span className="font-semibold text-[var(--pos-text)]">{label}</span>
                  <Badge tone={enabled ? "green" : "slate"}>{enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xl font-bold text-[var(--pos-text)]">Import / Export Shop Config</h3>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Exports settings only: branding, business profile, packages, service catalog, loyalty rules, and print settings. No customers, vehicles, tickets, payments, or inventory quantities are included.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void exportConfig()}>Export Shop Config</Button>
              <Button variant="secondary" onClick={() => setImportConfigJson(shopConfigJson)}>Duplicate Current Config</Button>
              <Button variant="secondary" onClick={() => void importConfig()} disabled={!importConfigJson.trim()}>Import Shop Config</Button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="text-sm font-semibold text-[var(--pos-muted)]">Exported JSON
                <textarea className="mt-2 min-h-64 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-bg)] p-3 font-mono text-xs text-[var(--pos-text)]" value={shopConfigJson} onChange={(event) => setShopConfigJson(event.target.value)} />
              </label>
              <label className="text-sm font-semibold text-[var(--pos-muted)]">Import JSON
                <textarea className="mt-2 min-h-64 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-bg)] p-3 font-mono text-xs text-[var(--pos-text)]" value={importConfigJson} onChange={(event) => setImportConfigJson(event.target.value)} placeholder="Paste settings-only shop config JSON here." />
              </label>
            </div>
          </Card>
        </div>
      ) : null}
      {packageEditor ? (
        <PackageEditorDrawer
          mode={packageEditor.mode}
          servicePackage={packageEditor.servicePackage}
          nextSortOrder={nextPackageSortOrder}
          onClose={() => setPackageEditor(null)}
          onSave={savePackageEditor}
        />
      ) : null}
      {packageConfirm ? (
        <ConfirmDialog
          title="Disable package?"
          message="Disable this package? It will no longer appear in new tickets."
          confirmLabel="Disable Package"
          danger
          onCancel={() => setPackageConfirm(null)}
          onConfirm={() => {
            const target = packageConfirm;
            setPackageConfirm(null);
            void togglePackageActive(target);
          }}
        />
      ) : null}
      {hardwareScannerOpen ? (
        <VinCameraScannerModal
          onClose={() => setHardwareScannerOpen(false)}
          onVinScanned={(vin, diagnostics) => {
            setHardwareScannerResult(diagnostics ?? { vin, rawValue: null, engine: "none", cameraLabel: null, attempts: 0 });
            setHardwareScannerOpen(false);
            notify({ tone: "success", title: "VIN scanner test complete", message: vin });
          }}
        />
      ) : null}
    </section>
  );
}
