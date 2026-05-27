import { useEffect, useState } from "react";
import { CustomerFleetStep } from "../../components/order-wizard/CustomerFleetStep";
import { CustomerSearchStep } from "../../components/order-wizard/CustomerSearchStep";
import { BaySelectionModal } from "../../components/order-wizard/BaySelectionModal";
import { OilFilterSearchModal } from "../../components/order-wizard/OilFilterSearchModal";
import { OrderReviewStep } from "../../components/order-wizard/OrderReviewStep";
import { OrderWizardShell } from "../../components/order-wizard/OrderWizardShell";
import { PackageWorkflowScreen } from "../../components/order-wizard/PackageWorkflowScreen";
import { PlateLookupStep } from "../../components/order-wizard/PlateLookupStep";
import { ServicingStep } from "../../components/order-wizard/ServicingStep";
import { SpecsStep } from "../../components/order-wizard/SpecsStep";
import { StartTicketPopout } from "../../components/order-wizard/StartTicketPopout";
import { VehicleMethodStep } from "../../components/order-wizard/VehicleMethodStep";
import { VinLookupStep } from "../../components/order-wizard/VinLookupStep";
import { emptyCustomerForm, useOrderWizardState } from "../../components/order-wizard/orderWizardState";
import type { VehicleSpecsForm, WizardStep } from "../../components/order-wizard/orderWizardTypes";
import { canNavigateToStep, getBlockedStepReason, hasVehicleStarted } from "../../components/order-wizard/wizardNavigation";
import { listActiveCatalogItems } from "../../lib/db/repositories/catalogRepo";
import { createCustomer, getCustomer, searchCustomersAdvanced } from "../../lib/db/repositories/customersRepo";
import { listActivePackages } from "../../lib/db/repositories/packagesRepo";
import { getSetting } from "../../lib/db/repositories/settingsRepo";
import { createTicketWithItems, listActiveTickets, startService } from "../../lib/db/repositories/ticketsRepo";
import { createWindowSticker, updateWindowStickerStatus } from "../../lib/db/repositories/windowStickersRepo";
import { createWindowStickerPrintJob, markPrintJobPreviewed, markPrintJobPrinted } from "../../lib/printing/printJobService";
import { applyVehicleDecode, createVehicle, findVehicleByPlate, findVehicleByVin, findVehicleByVinOrPlate, getVehicleById, searchVehicles, updateVehicle } from "../../lib/db/repositories/vehiclesRepo";
import { searchOilFilters } from "../../lib/db/repositories/inventoryRepo";
import { buildWindowStickerData, type WindowStickerPrintData } from "../../lib/domain/stickers/windowStickerBuilder";
import { getVehicleOilChangeDefaults } from "../../lib/domain/vehicles/vehicleServiceDefaults";
import { buildOilChangePackageLines } from "../../lib/domain/packages/packageWorkflow";
import { getPackageCategory } from "../../lib/domain/packages/packageCategories";
import { suggestEngineOil, type OilSelectionSuggestion } from "../../lib/domain/services/oilSelection";
import { calculatePackagePricing } from "../../lib/utils/pricing";
import { consumeStartTicketContext } from "../../lib/domain/startTicket/startTicketContext";
import { normalizeIdentifierDraft, validateCanLeaveCustomerStep, validateCanLeaveSpecsStep, validateCanSendToBay, validateStartTicketVehicleSpecs, validateVehicleIdentifier } from "../../lib/domain/startTicket/startTicketValidation";
import { normalizePlate, normalizePlateState } from "../../lib/domain/vehicles/plateUtils";
import { applyDecodedVehicleToDraft, decodeVinWithFallback, isVinDecodeEnabled } from "../../lib/integrations/vinDecoder/vinDecoder.service";
import { lookupPlateLocalFirst } from "../../lib/integrations/plateLookup/plateLookup.service";
import { extractVinFromScannedText } from "../../lib/domain/vehicles/vinUtils";
import type { NormalizedVehicleDecode } from "../../lib/integrations/vinDecoder/vinDecoder.types";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import type { TicketLineInput } from "../../types/ticket";
import { useToast } from "../../components/ui/useToast";
import { WindowStickerPreview } from "../../components/stickers/WindowStickerPreview";
import { VehicleInfoLookupModal } from "../../components/vehicle-info/VehicleInfoLookupModal";
import type { Customer } from "../../types/customer";
import type { Vehicle } from "../../types/vehicle";
import type { InventoryItem } from "../../types/inventory";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";
import type { VehicleInfoDefaultsInput } from "../../lib/db/repositories/vehicleInfoLookupRepo";

interface OrderWizardPageProps {
  onCreated: (ticketId: string) => void;
  onBackToStart?: () => void;
}

const stepOrder: WizardStep[] = ["vehicle", "specs", "customer", "servicing", "order"];

function buildPackageLines(input: {
  selectedPackage: ServicePackage | null;
  actualQuarts: string;
  filterType: PackageFilterType;
  selectedOilFilter?: OilFilterSuggestion | null;
  filterChoice?: string | null;
  addOnLines: TicketLineInput[];
  taxRate: number;
}): TicketLineInput[] {
  const isOilPackage = input.selectedPackage ? getPackageCategory(input.selectedPackage) === "Oil Changes" : false;
  const oilFilterPrice = input.filterChoice === "customer_supplied" || input.filterChoice === "no_filter" || input.filterChoice === "standard_unmatched"
    ? 0
    : Math.max(Number(input.selectedOilFilter?.retailPrice) || 0, 0);
  const actualQuarts = isOilPackage ? Number(input.actualQuarts) || 0 : 0;
  const packagePricing = calculatePackagePricing({
    selectedPackage: input.selectedPackage,
    actualQuarts,
    filterType: input.filterType,
    oilFilterPrice,
    oilFilterCost: input.selectedOilFilter?.cost,
    oilFilterTaxable: 1,
    addons: input.addOnLines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unit_price: line.unit_price,
      taxable: line.taxable,
      is_fee: line.item_type === "fee" ? 1 : 0,
      is_discount: line.item_type === "discount" ? 1 : 0
    })),
    taxRate: input.taxRate
  });
  const packageLines: TicketLineInput[] = [];
  if (input.selectedPackage) {
    packageLines.push({
      service_id: null,
      item_type: "package",
      package_id: input.selectedPackage.id,
      inventory_item_id: null,
      name: input.selectedPackage.name,
      quantity: 1,
      unit_price: input.selectedPackage.package_total ?? input.selectedPackage.base_price,
      taxable: input.selectedPackage.taxable
    });
    if (isOilPackage && oilFilterPrice > 0 && input.selectedOilFilter) {
      const filterSku = input.selectedOilFilter.sku ?? input.selectedOilFilter.productId ?? "Oil Filter";
      packageLines.push({
        service_id: null,
        item_type: "inventory",
        package_id: input.selectedPackage.id,
        inventory_item_id: input.selectedOilFilter.inventoryItemId ?? null,
        cost: input.selectedOilFilter.cost ?? null,
        sku: input.selectedOilFilter.sku ?? null,
        product_id: input.selectedOilFilter.productId ?? null,
        source_price_type: "inventory_retail",
        name: `Engine Oil Filter - ${filterSku}`,
        quantity: 1,
        unit_price: oilFilterPrice,
        taxable: 1
      });
    }
    if (isOilPackage && packagePricing.extraQuartTotal > 0) {
      packageLines.push({
        service_id: null,
        item_type: "fee",
        package_id: input.selectedPackage.id,
        inventory_item_id: null,
        name: "Extra Oil Quarts",
        quantity: packagePricing.extraQuarts,
        unit_price: input.selectedPackage.extra_quart_price,
        taxable: input.selectedPackage.taxable
      });
    }
    if (isOilPackage && packagePricing.filterFee > 0) {
      packageLines.push({
        service_id: null,
        item_type: "fee",
        package_id: input.selectedPackage.id,
        inventory_item_id: null,
        name: "Cartridge Filter Fee",
        quantity: 1,
        unit_price: input.selectedPackage.cartridge_filter_extra_fee,
        taxable: input.selectedPackage.taxable
      });
    }
  }
  return [...packageLines, ...input.addOnLines];
}

function inventoryItemToOilFilterSuggestion(item: InventoryItem): OilFilterSuggestion {
  return {
    inventoryItemId: item.id,
    sku: item.sku ?? undefined,
    productId: item.product_id ?? undefined,
    name: item.name,
    brand: item.vendor ?? undefined,
    retailPrice: item.retail_price,
    cost: item.cost,
    quantityOnHand: item.quantity_on_hand,
    source: "manual",
    confidence: "high",
    message: "Manually selected from local inventory."
  };
}

function specsFromVehicle(vehicle: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim?: string | null;
  sub_model?: string | null;
  drive_type?: string | null;
  fuel_type?: string | null;
  engine_model?: string | null;
  engine_displacement_l?: number | null;
  transmission_style?: string | null;
  vin: string | null;
  plate: string | null;
  plate_state: string | null;
  mileage: number | null;
  oil_type: string | null;
  notes: string | null;
}): VehicleSpecsForm {
  return {
    year: vehicle.year ? String(vehicle.year) : "",
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    trim: vehicle.trim ?? vehicle.sub_model ?? "",
    engine: vehicle.engine_model ?? (vehicle.engine_displacement_l ? `${vehicle.engine_displacement_l}L` : ""),
    drive_type: vehicle.drive_type ?? "",
    fuel_type: vehicle.fuel_type ?? "",
    transmission_style: vehicle.transmission_style ?? "",
    vin: vehicle.vin ?? "",
    plate: vehicle.plate ?? "",
    plate_state: vehicle.plate_state ?? "OH",
    mileage: vehicle.mileage ? String(vehicle.mileage) : "",
    oil_type: vehicle.oil_type ?? "",
    notes: vehicle.notes ?? ""
  };
}

function mergeLookupContextIntoSpecs(current: VehicleSpecsForm, input: {
  vin?: string | null;
  plate?: string | null;
  plate_state?: string | null;
}) {
  return {
    ...current,
    vin: input.vin?.trim().toUpperCase() || current.vin,
    plate: input.plate?.trim().toUpperCase() || current.plate,
    plate_state: input.plate_state?.trim().toUpperCase() || current.plate_state || "OH"
  };
}

export function OrderWizardPage({ onCreated, onBackToStart }: OrderWizardPageProps) {
  const { state, setState, totals } = useOrderWizardState();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [bayModalOpen, setBayModalOpen] = useState(false);
  const [bayCounts, setBayCounts] = useState({ bay1: 0, bay2: 0 });
  const [stickerPreview, setStickerPreview] = useState<{ stickerId: string; ticketId: string; printJobId: string | null; data: WindowStickerPrintData } | null>(null);
  const [filterSearchOpen, setFilterSearchOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [filterSearchResults, setFilterSearchResults] = useState<InventoryItem[]>([]);
  const [filterSearchLoading, setFilterSearchLoading] = useState(false);
  const [workflowPackage, setWorkflowPackage] = useState<ServicePackage | null>(null);
  const [vinDecodeEnabled, setVinDecodeEnabled] = useState(false);
  const [vinDecodeMessage, setVinDecodeMessage] = useState<string | null>(null);
  const [decodingVin, setDecodingVin] = useState(false);
  const [lastVinDecode, setLastVinDecode] = useState<NormalizedVehicleDecode | null>(null);
  const [vehicleInfoLookupOpen, setVehicleInfoLookupOpen] = useState(false);
  const [plateLookupSearching, setPlateLookupSearching] = useState(false);
  const [plateLookupSearched, setPlateLookupSearched] = useState(false);
  const { notify } = useToast();

  const closeStartTicketPopout = () => {
    if (!state.activePopout && onBackToStart) {
      onBackToStart();
      return;
    }
    setState((current) => {
      if (current.step === "servicing" || current.step === "order") return { ...current, activePopout: null };
      return {
        ...current,
        activePopout: null,
        step: "vehicle",
        vehicleSubstep: "method",
        validation: null
      };
    });
  };

  useEffect(() => {
    Promise.all([listActivePackages(), listActiveCatalogItems(), getSetting("tax_rate")])
      .then(([activePackages, activeCatalogItems, setting]) => {
        setPackages(activePackages);
        setCatalogItems(activeCatalogItems);
        setState((current) => ({ ...current, taxRate: setting ? Number(setting.value) || 0 : 0 }));
      })
      .catch((error: unknown) => setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to load service catalog." })));
  }, [setState]);

  useEffect(() => {
    isVinDecodeEnabled().then(setVinDecodeEnabled).catch(() => setVinDecodeEnabled(false));
  }, []);

  useEffect(() => {
    const rawQuote = localStorage.getItem("flynns_quote_conversion");
    if (!rawQuote) return;
    try {
      const parsed = JSON.parse(rawQuote) as { quoteNumber?: string; items?: Array<{ item_type?: string; package_id?: string | null; inventory_item_id?: string | null; name: string; quantity: number; unit_price: number; taxable: number }> };
      const lines: TicketLineInput[] = (parsed.items ?? []).map((item) => ({
        service_id: null,
        item_type: item.item_type === "labor" ? "service" : item.item_type === "package" || item.item_type === "inventory" || item.item_type === "fee" || item.item_type === "discount" || item.item_type === "custom" ? item.item_type : "custom",
        package_id: item.package_id ?? null,
        inventory_item_id: item.inventory_item_id ?? null,
        name: item.name,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        taxable: item.taxable ?? 1
      }));
      if (!lines.length) return;
      setState((current) => ({
        ...current,
        selectedCatalogItems: lines,
        selectedLines: lines,
        validation: `Quote ${parsed.quoteNumber ?? ""} loaded. Select customer, vehicle, and mileage before sending to bay.`
      }));
      notify({ tone: "success", title: "Quote loaded", message: "Quote items were added to this ticket draft." });
    } catch {
      notify({ tone: "error", title: "Quote conversion failed", message: "The saved quote payload could not be loaded." });
    } finally {
      localStorage.removeItem("flynns_quote_conversion");
    }
  }, [notify, setState]);

  useEffect(() => {
    const query = state.customerSearch.trim();
    if (query.length < 2) {
      setState((current) => current.customerMatches.length ? { ...current, customerMatches: [] } : current);
      return;
    }
    const timer = window.setTimeout(() => {
      searchCustomersAdvanced(query, {}, 25, 0)
        .then((matches) => setState((current) => ({ ...current, customerMatches: matches })))
        .catch((error: unknown) => setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to search customers." })));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [setState, state.customerSearch]);

  useEffect(() => {
    const context = consumeStartTicketContext();
    if (!context) return;
    void (async () => {
      try {
        const vehicle = context.vehicleId ? await getVehicleById(context.vehicleId) : null;
        const customerId = context.customerId ?? vehicle?.customer_id ?? null;
        const customer = customerId ? await getCustomer(customerId) : null;
        if ((context.vehicleId && !vehicle) || (customerId && !customer)) {
          notify({ tone: "error", title: "Selection missing", message: "Selected customer or vehicle could not be loaded." });
        }
        setState((current) => {
          if (context.startingPoint === "customer" && !vehicle && !customer) {
            return { ...current, selectedStartingPoint: "customer", customerFirstFlow: true, step: "customer", validation: null };
          }
          if (context.startingPoint === "manual" && !vehicle && !customer) {
            return { ...current, selectedStartingPoint: "manual", customerFirstFlow: false, step: "specs", validation: null };
          }
          if (vehicle) {
            const specs = specsFromVehicle(vehicle);
            const hasRequiredSpecs = Boolean(specs.year && specs.make && specs.model && specs.mileage);
            return {
              ...current,
              selectedStartingPoint: "vehicle",
              lookedUpVehicle: vehicle,
              selectedVehicleId: vehicle.id,
              selectedCustomer: customer,
              selectedCustomerId: customer?.id ?? null,
              customerForm: customer ? emptyCustomerForm : current.customerForm,
              vinInput: vehicle.vin ?? current.vinInput,
              plateInput: vehicle.plate ?? current.plateInput,
              plateState: vehicle.plate_state ?? current.plateState,
              specs,
              step: hasRequiredSpecs && customer ? "servicing" : hasRequiredSpecs ? "customer" : "specs",
              validation: null
            };
          }
          if (customer) {
            return {
              ...current,
              selectedStartingPoint: "customer",
              customerFirstFlow: true,
              selectedCustomer: customer,
              selectedCustomerId: customer.id,
              customerForm: emptyCustomerForm,
              step: "customer",
              validation: "Customer selected. Choose or enter a vehicle to continue."
            };
          }
          if (context.vin) {
            return {
              ...current,
              vehicleMethod: "vin",
              vinInput: context.vin,
              specs: { ...current.specs, vin: context.vin },
              step: "specs",
              validation: "VIN added. Complete vehicle specs to continue."
            };
          }
          return current;
        });
      } catch (error) {
        notify({ tone: "error", title: "Could not start ticket", message: error instanceof Error ? error.message : "Selected customer or vehicle could not be loaded." });
      }
    })();
  }, [notify, setState]);

  useEffect(() => {
    const activePackage = workflowPackage ?? state.selectedPackage;
    if (state.step !== "servicing" || !activePackage) return;
    let canceled = false;
    void Promise.all([
      getVehicleOilChangeDefaults(state.selectedVehicleId ?? state.lookedUpVehicle?.id ?? null, activePackage.included_quarts),
      suggestEngineOil(state.lookedUpVehicle, activePackage)
    ])
      .then(([defaults, oilSuggestion]) => {
        if (canceled) return;
        if (import.meta.env.DEV) {
          console.info("[oil-filter-suggestion]", {
            vehicleId: state.selectedVehicleId ?? state.lookedUpVehicle?.id ?? null,
            source: defaults.oilFilter.source,
            filterId: defaults.oilFilter.inventoryItemId ?? null,
            sku: defaults.oilFilter.sku ?? defaults.oilFilter.productId ?? null
          });
        }
        setState((current) => {
          const selectedPackage = workflowPackage ?? current.selectedPackage;
          if (current.step !== "servicing" || selectedPackage?.id !== activePackage.id) return current;
          if (!selectedPackage) return current;
          const nextActualQuarts = current.actualQuarts || (defaults.suggestedQuarts ? String(defaults.suggestedQuarts) : String(selectedPackage.included_quarts));
          const nextOilType = current.specs.oil_type || defaults.oilType || selectedPackage.oil_type || "";
          return {
            ...current,
            actualQuarts: nextActualQuarts,
            selectedLines: workflowPackage
              ? current.selectedLines
              : buildPackageLines({
                  selectedPackage: current.selectedPackage,
                  actualQuarts: nextActualQuarts,
                  filterType: current.filterType,
                  selectedOilFilter: current.selectedOilFilter ?? (defaults.oilFilter.source !== "none" ? defaults.oilFilter : null),
                  filterChoice: current.filterChoice ?? (defaults.oilFilter.source !== "none" ? "inventory" : "standard_unmatched"),
                  addOnLines: current.selectedCatalogItems,
                  taxRate: current.taxRate
                }),
            specs: { ...current.specs, oil_type: nextOilType },
            oilTypeOverride: current.oilTypeOverride || nextOilType,
            oilFilterSuggestion: defaults.oilFilter,
            selectedOilFilter: current.selectedOilFilter ?? (defaults.oilFilter.source !== "none" ? defaults.oilFilter : null),
            selectedOilFilterInventoryItemId: current.selectedOilFilterInventoryItemId ?? defaults.oilFilter.inventoryItemId ?? null,
            selectedOilFilterSku: current.selectedOilFilterSku ?? defaults.oilFilter.sku ?? defaults.oilFilter.productId ?? null,
            selectedOilFilterName: current.selectedOilFilterName ?? defaults.oilFilter.name ?? null,
            selectedOilFilterBrand: current.selectedOilFilterBrand ?? defaults.oilFilter.brand ?? null,
            selectedOilFilterRetailPrice: current.selectedOilFilterRetailPrice ?? defaults.oilFilter.retailPrice ?? null,
            selectedOilFilterCost: current.selectedOilFilterCost ?? defaults.oilFilter.cost ?? null,
            selectedOilFilterSource: current.selectedOilFilterSource ?? (defaults.oilFilter.source !== "none" ? defaults.oilFilter.source : null),
            filterChoice: current.filterChoice ?? (defaults.oilFilter.source !== "none" ? "inventory" : "standard_unmatched"),
            selectedOilInventoryItemId: current.selectedOilInventoryItemId ?? oilSuggestion.inventoryItemId ?? null,
            selectedOilSku: current.selectedOilSku ?? oilSuggestion.sku ?? null,
            selectedOilName: current.selectedOilName ?? oilSuggestion.name ?? null,
            selectedOilSource: current.selectedOilSource ?? oilSuggestion.source,
            quartsSuggestionSource: defaults.quartsSource,
            serviceDefaultsMessage: defaults.oilType ? "Oil type suggested from vehicle history." : "Oil type suggested from selected package."
          };
        });
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setState((current) => ({ ...current, serviceDefaultsMessage: error instanceof Error ? error.message : "Unable to load vehicle service defaults." }));
        }
      });
    return () => {
      canceled = true;
    };
  }, [setState, state.lookedUpVehicle, state.selectedPackage, state.selectedVehicleId, state.step, workflowPackage]);

  useEffect(() => {
    if (!filterSearchOpen) return;
    setFilterSearchLoading(true);
    const timer = window.setTimeout(() => {
      searchOilFilters(filterSearchQuery, 25)
        .then(setFilterSearchResults)
        .catch((error: unknown) => notify({ tone: "error", title: "Filter search failed", message: error instanceof Error ? error.message : "Unable to search oil filters." }))
        .finally(() => setFilterSearchLoading(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filterSearchOpen, filterSearchQuery, notify]);

  const goToStep = (step: WizardStep) => setState((current) => ({ ...current, step, validation: null }));
  const handleStepClick = (step: WizardStep) => {
    if (!canNavigateToStep(step, state)) {
      const reason = getBlockedStepReason(step, state) ?? "Finish the required steps before continuing.";
      setState((current) => ({ ...current, validation: reason }));
      notify({ tone: "error", title: "Step blocked", message: reason });
      return;
    }
    setState((current) => ({
      ...current,
      step,
      customerFirstFlow: step === "customer" && !hasVehicleStarted(current) ? true : current.customerFirstFlow,
      validation: null
    }));
  };
  const nextStep = () => {
    const currentIndex = stepOrder.indexOf(state.step);
    goToStep(stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)]);
  };
  const previousStep = () => {
    const currentIndex = stepOrder.indexOf(state.step);
    goToStep(stepOrder[Math.max(currentIndex - 1, 0)]);
  };

  const applyVehicleLookup = async (query: string, notFoundMessage: string) => {
    const normalizedQuery = query.trim();
    let match: Vehicle | null = null;
    let nextSpecsPatch: Partial<VehicleSpecsForm> = {};

    if (state.vehicleMethod === "vin") {
      const extraction = extractVinFromScannedText(normalizedQuery);
      if (!extraction.isValid || !extraction.candidate) {
        const reason = extraction.reason ?? "VIN must be 17 characters and cannot contain I, O, or Q.";
        setState((current) => ({ ...current, validation: reason }));
        notify({ tone: "error", title: "VIN needed", message: reason });
        return;
      }
      nextSpecsPatch = { vin: extraction.candidate };
      match = await findVehicleByVin(extraction.candidate);
    } else if (state.vehicleMethod === "plate") {
      const plate = normalizePlate(state.plateInput);
      const plateState = normalizePlateState(state.plateState);
      const identifierValidation = validateVehicleIdentifier({ plate, plate_state: plateState });
      if (!identifierValidation.valid) {
        const reason = identifierValidation.reason ?? "Enter a license plate and state before searching.";
        setState((current) => ({ ...current, validation: reason }));
        notify({ tone: "error", title: "Plate needed", message: reason });
        return;
      }
      setPlateLookupSearching(true);
      setPlateLookupSearched(false);
      nextSpecsPatch = { plate, plate_state: plateState };
      try {
        const result = await lookupPlateLocalFirst({ plate, state: plateState, country: "US", source: "start_ticket" });
        match = result.status === "found" && result.raw ? result.raw as Vehicle : await findVehicleByPlate(plate, plateState);
      } finally {
        setPlateLookupSearching(false);
        setPlateLookupSearched(true);
      }
    } else {
      const matches = await searchVehicles(query);
      match = matches[0] ?? null;
    }

    if (!match) {
      setState((current) => ({
        ...current,
        validation: notFoundMessage,
        lookedUpVehicle: state.vehicleMethod === "plate" ? null : current.lookedUpVehicle,
        selectedVehicleId: state.vehicleMethod === "plate" ? null : current.selectedVehicleId,
        specs: mergeLookupContextIntoSpecs(current.specs, {
          vin: nextSpecsPatch.vin ?? current.vinInput,
          plate: nextSpecsPatch.plate ?? current.plateInput,
          plate_state: nextSpecsPatch.plate_state ?? current.plateState
        }),
        step: state.vehicleMethod === "plate" ? "vehicle" : "specs",
        activePopout: state.vehicleMethod === "plate" ? "plateLookup" : "manualVehicle",
        vehicleSubstep: state.vehicleMethod === "plate" ? "plate" : current.vehicleSubstep
      }));
      return;
    }
    const customer = match.customer_id ? await getCustomer(match.customer_id) : null;
    setState((current) => ({
      ...current,
      lookedUpVehicle: match,
      selectedVehicleId: match.id,
      selectedCustomer: customer,
      selectedCustomerId: customer?.id ?? null,
      customerForm: customer ? emptyCustomerForm : current.customerForm,
      specs: { ...specsFromVehicle(match), mileage: "" },
      validation: null,
      step: state.vehicleMethod === "plate" ? "vehicle" : "specs",
      activePopout: state.vehicleMethod === "plate" ? "plateLookup" : "manualVehicle",
      vehicleSubstep: state.vehicleMethod === "plate" ? "plate" : current.vehicleSubstep
    }));
  };

  const decodeVinIntoSpecs = async () => {
    setDecodingVin(true);
    setVinDecodeMessage(null);
    try {
      const result = await decodeVinWithFallback(state.vinInput, { modelYear: state.specs.year || null });
      setVinDecodeMessage(result.message);
      if (result.ok && result.data) {
        const decoded = result.data;
        setLastVinDecode(decoded);
        setState((current) => ({
          ...current,
          vinInput: decoded.vin,
          activePopout: "manualVehicle",
          step: "specs",
          specs: applyDecodedVehicleToDraft(decoded, current.specs),
          validation: "VIN decoded. Confirm specs and mileage."
        }));
        notify({ tone: "success", title: "VIN decoded", message: [decoded.year, decoded.make, decoded.model].filter(Boolean).join(" ") || decoded.vin });
      } else {
        setLastVinDecode(null);
        notify({ tone: result.status === "disabled" ? "info" : "error", title: result.status === "disabled" ? "VIN decoder disabled" : "VIN decode unavailable", message: result.message });
      }
    } finally {
      setDecodingVin(false);
    }
  };

  const handleScannedVin = async (vinInput: string) => {
    const extraction = extractVinFromScannedText(vinInput);
    if (!extraction.isValid || !extraction.candidate || extraction.candidate.length !== 17) {
      setState((current) => ({ ...current, validation: extraction.reason ?? "No valid 17-character VIN was found." }));
      notify({ tone: "error", title: "VIN scan rejected", message: extraction.reason ?? "No valid 17-character VIN was found." });
      return;
    }
    const scannedVin = extraction.candidate;
    setState((current) => ({ ...current, vinInput: scannedVin, specs: { ...current.specs, vin: scannedVin }, validation: "VIN scanned. Searching local vehicles..." }));
    notify({ tone: "success", title: "VIN scanned", message: scannedVin });
    const match = await findVehicleByVin(scannedVin);
    if (match) {
      const customer = match.customer_id ? await getCustomer(match.customer_id) : null;
      setState((current) => ({
        ...current,
        vinInput: scannedVin,
        lookedUpVehicle: match,
        selectedVehicleId: match.id,
        selectedCustomer: customer,
        selectedCustomerId: customer?.id ?? null,
          customerForm: customer ? emptyCustomerForm : current.customerForm,
          specs: { ...specsFromVehicle(match), mileage: "" },
          validation: null,
          activePopout: "manualVehicle",
          step: "specs"
        }));
      return;
    }

    setDecodingVin(true);
    setVinDecodeMessage(null);
    try {
      const result = await decodeVinWithFallback(scannedVin, { modelYear: state.specs.year || null });
      setVinDecodeMessage(result.message);
      if (result.ok && result.data) {
        const decoded = result.data;
        setLastVinDecode(decoded);
        setState((current) => ({
          ...current,
          vinInput: decoded.vin,
          specs: applyDecodedVehicleToDraft(decoded, { ...current.specs, vin: decoded.vin }),
          activePopout: "manualVehicle",
          step: "specs",
          validation: "VIN decoded. Confirm specs and mileage."
        }));
        notify({ tone: "success", title: "VIN decoded", message: [decoded.year, decoded.make, decoded.model].filter(Boolean).join(" ") || decoded.vin });
      } else {
        setLastVinDecode(null);
        setState((current) => ({ ...current, vinInput: scannedVin, activePopout: "manualVehicle", specs: { ...current.specs, vin: scannedVin }, step: "specs", validation: "VIN decode unavailable. Confirm vehicle specs manually." }));
        notify({ tone: result.status === "disabled" ? "info" : "error", title: result.status === "disabled" ? "VIN decoder disabled" : "VIN decode unavailable", message: result.message });
      }
    } finally {
      setDecodingVin(false);
    }
  };

  const useExistingPlateVehicle = (mileage: string) => {
    if (!state.lookedUpVehicle) return;
    const currentMileage = Number(mileage);
    if (!Number.isFinite(currentMileage) || currentMileage <= 0) {
      setState((current) => ({ ...current, validation: "Enter current mileage before using this vehicle." }));
      notify({ tone: "error", title: "Mileage needed", message: "Enter current mileage before using this vehicle." });
      return;
    }
    const specs = specsFromVehicle({ ...state.lookedUpVehicle, mileage: currentMileage });
    setState((current) => ({
      ...current,
      specs,
      vinInput: specs.vin || current.vinInput,
      plateInput: specs.plate || current.plateInput,
      plateState: specs.plate_state || current.plateState,
      step: specs.year && specs.make && specs.model
        ? (current.selectedCustomer || current.selectedCustomerId ? "servicing" : "customer")
        : "specs",
      activePopout: specs.year && specs.make && specs.model
        ? (current.selectedCustomer || current.selectedCustomerId ? null : "customerSearch")
        : "manualVehicle",
      validation: current.selectedCustomer || current.selectedCustomerId ? null : "Existing vehicle has no linked customer. Select or add the customer before servicing."
    }));
  };

  const continueWithNewPlateVehicle = () => {
    const plate = normalizePlate(state.plateInput);
    const plateState = normalizePlateState(state.plateState);
    const identifierValidation = validateVehicleIdentifier({ plate, plate_state: plateState });
    if (!identifierValidation.valid) {
      const reason = identifierValidation.reason ?? "Enter a license plate and state before continuing.";
      setState((current) => ({ ...current, validation: reason }));
      notify({ tone: "error", title: "Plate needed", message: reason });
      return;
    }
    setState((current) => ({
      ...current,
      lookedUpVehicle: null,
      selectedVehicleId: null,
      specs: mergeLookupContextIntoSpecs(current.specs, { plate, plate_state: plateState }),
      step: "specs",
      activePopout: "manualVehicle",
      validation: "New vehicle. Confirm specs and mileage, then select or add the customer."
    }));
  };

  const validateSpecs = () => {
    const specsValidation = validateCanLeaveSpecsStep(state);
    if (!specsValidation.valid) {
      const message = specsValidation.message ?? specsValidation.reason ?? "Finish vehicle specs before continuing.";
      setState((current) => ({ ...current, validation: message }));
      notify({ tone: "error", title: "Vehicle specs needed", message });
      return false;
    }
    const lastMileage = state.lookedUpVehicle?.mileage;
    const currentMileage = Number(state.specs.mileage);
    if (lastMileage && Number.isFinite(currentMileage) && currentMileage < lastMileage) {
      const confirmed = window.confirm("Current mileage is lower than last recorded mileage. Continue?");
      if (!confirmed) return false;
    }
    return true;
  };

  const validateCustomer = () => {
    const customerValidation = validateCanLeaveCustomerStep(state);
    if (!customerValidation.valid) {
      const message = customerValidation.message ?? "Select or add a customer before servicing.";
      setState((current) => ({ ...current, validation: message }));
      notify({ tone: "error", title: "Customer needed", message });
      return false;
    }
    return true;
  };

  const validateServices = () => {
    const serviceValidation = validateCanSendToBay(state);
    if (!serviceValidation.valid) {
      const message = serviceValidation.message ?? "Finish service selections before continuing.";
      setState((current) => ({ ...current, validation: message }));
      notify({ tone: "error", title: "Service needed", message });
      return false;
    }
    return true;
  };

  const rebuildPackageLines = (next: {
    selectedPackage: ServicePackage | null;
    actualQuarts: string;
    filterType: PackageFilterType;
    selectedOilFilter?: OilFilterSuggestion | null;
    filterChoice?: string | null;
    addOnLines: TicketLineInput[];
  }) => buildPackageLines({
    ...next,
    selectedOilFilter: next.selectedOilFilter ?? state.selectedOilFilter,
    filterChoice: next.filterChoice ?? state.filterChoice,
    taxRate: state.taxRate
  });

  const syncLines = (updates: Partial<Pick<typeof state, "selectedPackage" | "actualQuarts" | "filterType" | "selectedCatalogItems">>) => {
    setState((current) => {
      const next = {
        selectedPackage: updates.selectedPackage !== undefined ? updates.selectedPackage : current.selectedPackage,
        actualQuarts: updates.actualQuarts !== undefined ? updates.actualQuarts : current.actualQuarts,
        filterType: updates.filterType !== undefined ? updates.filterType : current.filterType,
        addOnLines: updates.selectedCatalogItems !== undefined ? updates.selectedCatalogItems : current.selectedCatalogItems
      };
      return {
        ...current,
        ...updates,
        selectedLines: rebuildPackageLines(next),
        validation: null
      };
    });
  };

  const addCatalogItem = (item: ServiceCatalogItem) => {
    setState((current) => {
      const itemType = item.is_discount ? "discount" : item.is_fee ? "fee" : "service";
      const existing = current.selectedCatalogItems.find((line) => line.service_id === item.id);
      const selectedCatalogItems = existing
        ? current.selectedCatalogItems.map((line) => (line.service_id === item.id ? { ...line, quantity: line.quantity + 1 } : line))
        : [
            ...current.selectedCatalogItems,
            {
              service_id: item.id,
              item_type: itemType,
              package_id: null,
              inventory_item_id: item.inventory_item_id,
              name: item.name,
              quantity: 1,
              unit_price: item.base_price,
              taxable: item.taxable
            } satisfies TicketLineInput
          ];
      return {
        ...current,
        selectedCatalogItems,
        selectedLines: rebuildPackageLines({
          selectedPackage: current.selectedPackage,
          actualQuarts: current.actualQuarts,
          filterType: current.filterType,
          addOnLines: selectedCatalogItems
        }),
        validation: null
      };
    });
  };

  const addCustomLine = () => {
    if (!state.customLine.name.trim()) {
      setState((current) => ({ ...current, validation: "Custom item name is required." }));
      notify({ tone: "error", title: "Custom item needed", message: "Enter a name before adding the item." });
      return;
    }
    setState((current) => ({
      ...current,
      selectedLines: [
        ...current.selectedLines,
        {
          service_id: null,
          item_type: "custom",
          package_id: null,
          inventory_item_id: null,
          name: current.customLine.name.trim(),
          quantity: Math.max(Number(current.customLine.quantity) || 1, 1),
          unit_price: Number(current.customLine.unit_price) || 0,
          taxable: current.customLine.taxable ? 1 : 0
        }
      ],
      selectedCatalogItems: [
        ...current.selectedCatalogItems,
        {
          service_id: null,
          item_type: "custom",
          package_id: null,
          inventory_item_id: null,
          name: current.customLine.name.trim(),
          quantity: Math.max(Number(current.customLine.quantity) || 1, 1),
          unit_price: Number(current.customLine.unit_price) || 0,
          taxable: current.customLine.taxable ? 1 : 0
        }
      ],
      customLine: { name: "", quantity: "1", unit_price: "", taxable: true },
      validation: null
    }));
  };

  const buildPackageDetails = () => {
    if (!state.selectedPackage) return null;
    const actualQuarts = Number(state.actualQuarts) || state.selectedPackage.included_quarts;
    const pricing = calculatePackagePricing({
      selectedPackage: state.selectedPackage,
      actualQuarts,
      filterType: state.filterType,
      oilFilterPrice: state.filterChoice === "customer_supplied" || state.filterChoice === "no_filter" || state.filterChoice === "standard_unmatched"
        ? 0
        : Math.max(Number(state.selectedOilFilter?.retailPrice) || Number(state.selectedOilFilterRetailPrice) || 0, 0),
      oilFilterCost: state.selectedOilFilter?.cost ?? state.selectedOilFilterCost ?? undefined,
      oilFilterTaxable: 1,
      addons: [],
      taxRate: state.taxRate
    });
    return {
      package_id: state.selectedPackage.id,
      package_name: state.selectedPackage.name,
      oil_brand: state.selectedPackage.oil_brand,
      oil_type: state.selectedPackage.oil_type,
      included_quarts: state.selectedPackage.included_quarts,
      actual_quarts: actualQuarts,
      extra_quarts: pricing.extraQuarts,
      extra_quart_price: state.selectedPackage.extra_quart_price,
      extra_quart_total: pricing.extraQuartTotal,
      filter_type: state.filterType,
      cartridge_filter_extra_fee: state.filterType === "cartridge" ? state.selectedPackage.cartridge_filter_extra_fee : 0,
      oil_filter_inventory_item_id: state.filterChoice === "customer_supplied" || state.filterChoice === "no_filter" ? null : state.selectedOilFilterInventoryItemId,
      oil_filter_sku: state.filterChoice === "customer_supplied" || state.filterChoice === "no_filter" ? null : state.selectedOilFilterSku,
      oil_filter_name: state.filterChoice === "customer_supplied" ? "Customer supplied filter" : state.filterChoice === "no_filter" ? "No filter" : state.selectedOilFilterName,
      oil_filter_source: state.filterChoice ?? state.selectedOilFilterSource,
      oil_inventory_item_id: state.selectedOilInventoryItemId,
      oil_sku: state.selectedOilSku,
      oil_name: state.selectedOilName ?? (state.oilTypeOverride.trim() || state.specs.oil_type || state.selectedPackage.oil_type),
      oil_source: state.selectedOilSource,
      package_base_price: state.selectedPackage.base_service_amount ?? state.selectedPackage.base_price,
      package_total: pricing.packageBase + pricing.oilFilterTotal + pricing.extraQuartTotal + pricing.filterFee
    };
  };

  const persistOrder = async (): Promise<{ ticketId: string; customer: Customer; vehicle: Vehicle } | null> => {
    const workflowValidation = validateCanSendToBay(state);
    if (!workflowValidation.valid) {
      const message = workflowValidation.message ?? "Finish required ticket details before continuing.";
      setState((current) => ({ ...current, validation: message }));
      notify({ tone: "error", title: "Ticket not ready", message });
      return null;
    }
    const normalizedIdentifier = normalizeIdentifierDraft(state.specs);
    const duplicateBeforeCustomerSave = state.lookedUpVehicle
      ? null
      : await findVehicleByVinOrPlate({
        vin: normalizedIdentifier.vin || null,
        plate: normalizedIdentifier.plate || null,
        state: normalizedIdentifier.plate ? normalizedIdentifier.plate_state : null
      });
    if (duplicateBeforeCustomerSave) {
      const duplicateCustomer = duplicateBeforeCustomerSave.customer_id ? await getCustomer(duplicateBeforeCustomerSave.customer_id) : null;
      setState((current) => ({
        ...current,
        lookedUpVehicle: duplicateBeforeCustomerSave,
        selectedVehicleId: duplicateBeforeCustomerSave.id,
        selectedCustomer: duplicateCustomer,
        selectedCustomerId: duplicateCustomer?.id ?? null,
        customerForm: duplicateCustomer ? emptyCustomerForm : current.customerForm,
        specs: specsFromVehicle({ ...duplicateBeforeCustomerSave, mileage: Number(current.specs.mileage) || duplicateBeforeCustomerSave.mileage }),
        validation: "Existing vehicle found. Review it and continue instead of creating a duplicate.",
        step: "specs"
      }));
      notify({ tone: "error", title: "Existing vehicle found", message: "Use the existing vehicle match before creating the ticket." });
      return null;
    }
    const customer =
      state.selectedCustomer ??
      (await createCustomer({
        first_name: state.customerForm.first_name.trim(),
        last_name: state.customerForm.last_name.trim(),
        phone: state.customerForm.phone.trim(),
        email: state.customerForm.email.trim() || null,
        notes: state.customerForm.notes.trim() || null,
        firebase_uid: null,
        referral_code: null
      }));
    if (!state.selectedCustomer) notify({ tone: "success", title: "Customer saved", message: `${customer.first_name} ${customer.last_name}` });

    const vehicleInput = {
      customer_id: customer.id,
      vin: normalizedIdentifier.vin || null,
      plate: normalizedIdentifier.plate || null,
      plate_state: normalizedIdentifier.plate ? normalizedIdentifier.plate_state || null : null,
      year: Number(state.specs.year),
      make: state.specs.make.trim(),
      model: state.specs.model.trim(),
      trim: state.specs.trim.trim() || null,
      sub_model: state.specs.trim.trim() || null,
      engine_model: state.specs.engine.trim() || null,
      drive_type: state.specs.drive_type.trim() || null,
      fuel_type: state.specs.fuel_type.trim() || null,
      transmission_style: state.specs.transmission_style.trim() || null,
      mileage: Number(state.specs.mileage),
      oil_type: state.oilTypeOverride.trim() || state.specs.oil_type.trim() || null,
      notes: [state.specs.engine ? `Engine: ${state.specs.engine}` : "", state.specs.notes].filter(Boolean).join(" | ") || null
    };
    const duplicate = state.lookedUpVehicle
      ? null
      : await findVehicleByVinOrPlate({ vin: vehicleInput.vin, plate: vehicleInput.plate, state: vehicleInput.plate_state });
    if (duplicate) {
      const duplicateCustomer = duplicate.customer_id ? await getCustomer(duplicate.customer_id) : null;
      setState((current) => ({
        ...current,
        lookedUpVehicle: duplicate,
        selectedVehicleId: duplicate.id,
        selectedCustomer: duplicateCustomer ?? customer,
        selectedCustomerId: duplicateCustomer?.id ?? customer.id,
        specs: specsFromVehicle({ ...duplicate, mileage: vehicleInput.mileage }),
        validation: "Existing vehicle found. Review it and continue instead of creating a duplicate.",
        step: "specs"
      }));
      notify({ tone: "error", title: "Existing vehicle found", message: "Use the existing vehicle match before creating the ticket." });
      return null;
    }
    const vehicle = state.lookedUpVehicle ?? (await createVehicle(vehicleInput));
    if (state.lookedUpVehicle) await updateVehicle(state.lookedUpVehicle.id, vehicleInput);
    if (lastVinDecode && vehicleInput.vin && lastVinDecode.vin === vehicleInput.vin.trim().toUpperCase()) {
      await applyVehicleDecode(vehicle.id, lastVinDecode, false);
    }
    if (!state.lookedUpVehicle) notify({ tone: "success", title: "Vehicle saved", message: [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") });

    const ticket = await createTicketWithItems({
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      items: state.selectedLines,
      customer_concern: state.customerConcern.trim() || null,
      technician_notes: state.technicianNotes.trim() || null,
      internal_notes: state.internalNotes.trim() || null,
      taxRate: state.taxRate,
      packageDetails: buildPackageDetails()
    });
    return { ticketId: ticket.id, customer, vehicle };
  };

  const openBaySelection = async () => {
    if (saving) return;
    const workflowValidation = validateCanSendToBay(state);
    if (!workflowValidation.valid) {
      const message = workflowValidation.message ?? "Finish required ticket details before sending to bay.";
      setState((current) => ({ ...current, validation: message }));
      notify({ tone: "error", title: "Ticket not ready", message });
      return;
    }
    const activeTickets = await listActiveTickets();
    setBayCounts({
      bay1: activeTickets.filter((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 1").length,
      bay2: activeTickets.filter((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 2").length
    });
    setBayModalOpen(true);
  };

  const startServiceFromWizard = async (bay: "Bay 1" | "Bay 2") => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await persistOrder();
      if (!result) return;
      await startService(result.ticketId, bay);
      const actualQuarts = Number(state.actualQuarts) || state.selectedPackage?.included_quarts || 0;
      const nextMilesSetting = await getSetting("next_service_miles");
      const nextMonthsSetting = await getSetting("next_service_months");
      const disclaimerSetting = await getSetting("sticker_disclaimer");
      const stickerData = buildWindowStickerData({
        ticketId: result.ticketId,
        customer: result.customer,
        vehicle: { ...result.vehicle, mileage: Number(state.specs.mileage) || result.vehicle.mileage },
        servicePackage: state.selectedPackage,
        actualQuarts,
        oilTypeOverride: state.oilTypeOverride.trim() || state.specs.oil_type || state.selectedPackage?.oil_type || null,
        oilFilter: state.selectedOilFilter,
        nextServiceMiles: Number(nextMilesSetting?.value) || 3000,
        nextServiceMonths: Number(nextMonthsSetting?.value) || 3,
        disclaimer: disclaimerSetting?.value ?? null
      });
      const sticker = await createWindowSticker({
        ticket_id: result.ticketId,
        customer_id: result.customer.id,
        vehicle_id: result.vehicle.id,
        print_data_json: JSON.stringify(stickerData)
      });
      const printJob = await createWindowStickerPrintJob(result.ticketId).catch(() => null);
      setBayModalOpen(false);
      setStickerPreview({ stickerId: sticker.id, ticketId: result.ticketId, printJobId: printJob?.id ?? null, data: stickerData });
      notify({ tone: "success", title: `Service started in ${bay}`, message: "Window sticker queued." });
    } catch (error) {
      setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to start service." }));
      notify({ tone: "error", title: "Could not start service", message: error instanceof Error ? error.message : "Unable to start service." });
    } finally {
      setSaving(false);
    }
  };

  const selectedOil: OilSelectionSuggestion | null = state.selectedOilName || state.selectedOilSku || state.selectedOilInventoryItemId
    ? {
        inventoryItemId: state.selectedOilInventoryItemId ?? undefined,
        sku: state.selectedOilSku ?? undefined,
        name: state.selectedOilName ?? undefined,
        source: state.selectedOilSource ?? "manual",
        message: state.selectedOilSource === "manual" ? "Manually selected." : "Suggested oil selection."
      }
    : null;

  const addWorkflowPackageToInvoice = () => {
    if (!workflowPackage) return;
    const packageLines = buildOilChangePackageLines({
      servicePackage: workflowPackage,
      actualQuarts: state.actualQuarts || String(workflowPackage.included_quarts),
      filterType: state.filterType,
      selectedOilFilter: state.selectedOilFilter,
      filterChoice: state.filterChoice,
      addOnLines: state.selectedCatalogItems,
      taxRate: state.taxRate
    });
    setState((current) => ({
      ...current,
      selectedPackage: workflowPackage,
      actualQuarts: current.actualQuarts || String(workflowPackage.included_quarts),
      selectedLines: packageLines,
      validation: null
    }));
    setWorkflowPackage(null);
    notify({ tone: "success", title: "Package added", message: `${workflowPackage.name} added to invoice.` });
  };

  const createOrder = async () => {
    if (saving) return;
    const workflowValidation = validateCanSendToBay(state);
    if (!workflowValidation.valid) {
      const message = workflowValidation.message ?? "Finish required ticket details before creating the order.";
      setState((current) => ({ ...current, validation: message }));
      notify({ tone: "error", title: "Ticket not ready", message });
      return;
    }
    setSaving(true);
    try {
      const result = await persistOrder();
      if (!result) return;
      notify({ tone: "success", title: "Ticket created", message: "Order checked in locally." });
      onCreated(result.ticketId);
    } catch (error) {
      setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to create order." }));
      notify({ tone: "error", title: "Could not create order", message: error instanceof Error ? error.message : "Unable to create order." });
    } finally {
      setSaving(false);
    }
  };

  const applyVehicleInfoDefaultsToWizard = async (defaults: VehicleInfoDefaultsInput) => {
    const filterSku = defaults.oil_filter_sku?.trim();
    let filterSuggestion: OilFilterSuggestion | null = null;
    if (filterSku) {
      const [matched] = await searchOilFilters(filterSku, 1).catch(() => []);
      filterSuggestion = matched ? inventoryItemToOilFilterSuggestion(matched) : {
        sku: filterSku,
        name: `Oil Filter ${filterSku}`,
        source: "manual",
        confidence: "low",
        message: "Saved from verified vehicle lookup. Match it to local inventory before checkout."
      };
    }
    setState((current) => {
      const nextActualQuarts = defaults.oil_capacity ? String(defaults.oil_capacity) : current.actualQuarts;
      const nextOilType = defaults.oil_type ?? current.specs.oil_type;
      return {
        ...current,
        actualQuarts: nextActualQuarts,
        specs: { ...current.specs, oil_type: nextOilType },
        oilTypeOverride: defaults.oil_type ?? current.oilTypeOverride,
        selectedOilFilter: filterSuggestion ?? current.selectedOilFilter,
        selectedOilFilterInventoryItemId: filterSuggestion?.inventoryItemId ?? current.selectedOilFilterInventoryItemId,
        selectedOilFilterSku: filterSuggestion?.sku ?? filterSuggestion?.productId ?? current.selectedOilFilterSku,
        selectedOilFilterName: filterSuggestion?.name ?? current.selectedOilFilterName,
        selectedOilFilterBrand: filterSuggestion?.brand ?? current.selectedOilFilterBrand,
        selectedOilFilterRetailPrice: filterSuggestion?.retailPrice ?? current.selectedOilFilterRetailPrice,
        selectedOilFilterCost: filterSuggestion?.cost ?? current.selectedOilFilterCost,
        selectedOilFilterSource: filterSuggestion?.source ?? current.selectedOilFilterSource,
        filterChoice: filterSuggestion?.inventoryItemId ? "inventory" : current.filterChoice,
        serviceDefaultsMessage: "Vehicle info lookup defaults applied. Verify before sending to bay.",
        validation: null
      };
    });
  };

  return (
    <>
    <OrderWizardShell currentStep={state.step} state={state} onStepClick={handleStepClick}>
      {state.step === "servicing" && workflowPackage ? (
        <PackageWorkflowScreen
          servicePackage={workflowPackage}
          selectedCustomer={state.selectedCustomer}
          specs={state.specs}
          actualQuarts={state.actualQuarts || String(workflowPackage.included_quarts)}
          filterType={state.filterType}
          oilTypeOverride={state.oilTypeOverride}
          selectedOilFilter={state.selectedOilFilter}
          oilFilterSuggestion={state.oilFilterSuggestion}
          filterChoice={state.filterChoice}
          selectedOil={selectedOil}
          taxRate={state.taxRate}
          onBack={() => setWorkflowPackage(null)}
          onActualQuartsChange={(actualQuarts) => setState((current) => ({ ...current, actualQuarts }))}
          onFilterTypeChange={(filterType) => setState((current) => {
            if (filterType === "customer_supplied") {
              return {
                ...current,
                filterType,
                selectedOilFilter: null,
                selectedOilFilterInventoryItemId: null,
                selectedOilFilterSku: null,
                selectedOilFilterName: "Customer supplied filter",
                selectedOilFilterBrand: null,
                selectedOilFilterRetailPrice: null,
                selectedOilFilterCost: null,
                selectedOilFilterSource: "customer_supplied",
                filterChoice: "customer_supplied"
              };
            }
            if (filterType === "none") {
              return {
                ...current,
                filterType,
                selectedOilFilter: null,
                selectedOilFilterInventoryItemId: null,
                selectedOilFilterSku: null,
                selectedOilFilterName: "No filter",
                selectedOilFilterBrand: null,
                selectedOilFilterRetailPrice: null,
                selectedOilFilterCost: null,
                selectedOilFilterSource: "no_filter",
                filterChoice: "no_filter"
              };
            }
            if (current.filterChoice === "customer_supplied" || current.filterChoice === "no_filter") {
              return { ...current, filterType, filterChoice: "standard_unmatched", selectedOilFilterSource: null };
            }
            return { ...current, filterType };
          })}
          onOilTypeOverrideChange={(oilTypeOverride) => setState((current) => ({ ...current, oilTypeOverride, specs: { ...current.specs, oil_type: oilTypeOverride } }))}
          onUseFilter={(filter, choice) => setState((current) => ({
            ...current,
            selectedOilFilter: filter,
            selectedOilFilterInventoryItemId: filter.inventoryItemId ?? null,
            selectedOilFilterSku: filter.sku ?? filter.productId ?? null,
            selectedOilFilterName: filter.name ?? null,
            selectedOilFilterBrand: filter.brand ?? null,
            selectedOilFilterRetailPrice: filter.retailPrice ?? null,
            selectedOilFilterCost: filter.cost ?? null,
            selectedOilFilterSource: filter.source,
            filterChoice: choice
          }))}
          onCustomerSuppliedFilter={() => setState((current) => ({
            ...current,
            selectedOilFilter: null,
            selectedOilFilterInventoryItemId: null,
            selectedOilFilterSku: null,
            selectedOilFilterName: "Customer supplied filter",
            selectedOilFilterBrand: null,
            selectedOilFilterRetailPrice: null,
            selectedOilFilterCost: null,
            selectedOilFilterSource: "customer_supplied",
            filterChoice: "customer_supplied",
            filterType: "customer_supplied"
          }))}
          onNoFilter={() => setState((current) => ({
            ...current,
            selectedOilFilter: null,
            selectedOilFilterInventoryItemId: null,
            selectedOilFilterSku: null,
            selectedOilFilterName: "No filter",
            selectedOilFilterBrand: null,
            selectedOilFilterRetailPrice: null,
            selectedOilFilterCost: null,
            selectedOilFilterSource: "no_filter",
            filterChoice: "no_filter",
            filterType: "none"
          }))}
          onSelectOil={(oil) => setState((current) => ({
            ...current,
            selectedOilInventoryItemId: oil.inventoryItemId ?? null,
            selectedOilSku: oil.sku ?? null,
            selectedOilName: oil.name ?? null,
            selectedOilSource: oil.source,
            oilTypeOverride: oil.formulation ?? oil.viscosity ?? current.oilTypeOverride,
            specs: { ...current.specs, oil_type: oil.formulation ?? oil.viscosity ?? current.specs.oil_type }
          }))}
          onAddPackage={addWorkflowPackageToInvoice}
        />
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "method" ? (
        <VehicleMethodStep
          onSelectCustomer={() => setState((current) => ({
            ...current,
            selectedStartingPoint: "customer",
            activePopout: "customerSearch",
            customerFirstFlow: true,
            step: "customer",
            validation: null
          }))}
          onSelectVin={() => setState((current) => ({ ...current, activePopout: "vinLookup", vehicleMethod: "vin", vehicleSubstep: "vin", validation: null }))}
          onSelectPlate={() => {
            setPlateLookupSearched(false);
            setState((current) => ({ ...current, activePopout: "plateLookup", vehicleMethod: "plate", vehicleSubstep: "plate", validation: null }));
          }}
          onSelectManual={() => setState((current) => ({ ...current, selectedStartingPoint: "manual", activePopout: "manualVehicle", step: "specs", validation: null }))}
        />
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "vin" ? (
        <StartTicketPopout title="VIN Lookup" subtitle="Scan, type, or decode a VIN while manual entry remains available." onClose={closeStartTicketPopout}>
          <VinLookupStep
            vin={state.vinInput}
            validation={state.validation}
            decodeEnabled={vinDecodeEnabled}
            decodeResult={vinDecodeMessage}
            decodedVehicle={lastVinDecode}
            decoding={decodingVin}
            onChange={(vinInput) => setState((current) => ({ ...current, vinInput, specs: { ...current.specs, vin: vinInput } }))}
            onBack={closeStartTicketPopout}
            onSearch={() => void applyVehicleLookup(state.vinInput, "No local VIN match found. Continue with manual specs.")}
            onScannedVin={(vinInput) => void handleScannedVin(vinInput)}
            onDecode={() => void decodeVinIntoSpecs()}
            onUseDecoded={() => setState((current) => ({
              ...current,
              activePopout: "manualVehicle",
              specs: lastVinDecode ? applyDecodedVehicleToDraft(lastVinDecode, current.specs) : current.specs,
              step: "specs",
              validation: lastVinDecode ? "Decoded specs applied. Confirm mileage before continuing." : null
            }))}
            onContinue={() => setState((current) => ({ ...current, activePopout: "manualVehicle", specs: { ...current.specs, vin: current.vinInput || current.specs.vin }, step: "specs", validation: null }))}
          />
        </StartTicketPopout>
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "plate" ? (
        <StartTicketPopout title="License Plate Lookup" subtitle="Search local vehicles by plate and state." onClose={closeStartTicketPopout}>
          <PlateLookupStep
            plate={state.plateInput}
            plateState={state.plateState}
            validation={state.validation}
            searching={plateLookupSearching}
            searched={plateLookupSearched}
            matchedVehicle={state.lookedUpVehicle}
            matchedCustomer={state.selectedCustomer}
            onPlateChange={(plateInput) => {
              setPlateLookupSearched(false);
              setState((current) => ({ ...current, plateInput: normalizePlate(plateInput), lookedUpVehicle: null, selectedVehicleId: null, specs: { ...current.specs, plate: normalizePlate(plateInput) } }));
            }}
            onStateChange={(plateState) => {
              setPlateLookupSearched(false);
              setState((current) => ({ ...current, plateState: normalizePlateState(plateState), lookedUpVehicle: null, selectedVehicleId: null, specs: { ...current.specs, plate_state: normalizePlateState(plateState) } }));
            }}
            onBack={closeStartTicketPopout}
            onSearch={() => void applyVehicleLookup(state.plateInput, `No local vehicle found for ${normalizePlate(state.plateInput)} ${normalizePlateState(state.plateState)}.`)}
            onUseExistingVehicle={useExistingPlateVehicle}
            onContinue={continueWithNewPlateVehicle}
          />
        </StartTicketPopout>
      ) : null}
      {state.step === "specs" ? (
        <StartTicketPopout title={state.lookedUpVehicle ? "Confirm Vehicle Specs" : "Manual Vehicle Entry"} subtitle="Confirm the vehicle, identifier, and current mileage before service selection." onClose={closeStartTicketPopout} closeOnBackdrop={false}>
          <SpecsStep
            specs={state.specs}
            validation={state.validation}
            decodedBy={lastVinDecode?.vin === state.specs.vin ? "NHTSA" : null}
            matchedVehicle={state.lookedUpVehicle}
            matchedCustomer={state.selectedCustomer}
            onChange={(specs) => setState((current) => ({ ...current, specs }))}
            onPrevious={closeStartTicketPopout}
            onNext={() => {
              if (!validateSpecs()) return;
              if (state.selectedCustomer || state.selectedCustomerId) {
                setState((current) => ({ ...current, activePopout: null, step: "servicing", validation: null }));
                return;
              }
              setState((current) => ({
                ...current,
                activePopout: "customerSearch",
                step: "customer",
                validation: "New vehicle. Select or add the customer before continuing."
              }));
            }}
            onLookupVehicleInfo={() => setVehicleInfoLookupOpen(true)}
          />
        </StartTicketPopout>
      ) : null}
      {state.step === "customer" && state.customerFirstFlow ? (
        <StartTicketPopout title={state.selectedCustomer ? "Select Vehicle" : "Find Customer"} subtitle={state.selectedCustomer ? `Choose a vehicle for ${state.selectedCustomer.first_name} ${state.selectedCustomer.last_name}.` : "Search by name, phone, email, VIN, or plate."} onClose={closeStartTicketPopout} closeOnBackdrop={false}>
          <CustomerSearchStep
            selectedCustomer={state.selectedCustomer}
            selectedVehicleId={state.selectedVehicleId}
            validation={state.validation}
            onBack={closeStartTicketPopout}
            onSelectCustomer={(selectedCustomer) => setState((current) => ({
              ...current,
              activePopout: "customerVehicles",
              selectedCustomer,
              selectedCustomerId: selectedCustomer.id,
              lookedUpVehicle: null,
              selectedVehicleId: null,
              specs: { ...current.specs, mileage: "" },
              customerForm: emptyCustomerForm,
              validation: null
            }))}
            onUseVehicle={(vehicle) => {
              const specs = specsFromVehicle(vehicle);
              const specsValidation = validateStartTicketVehicleSpecs(specs);
              setState((current) => ({
                ...current,
                activePopout: specsValidation.valid ? null : "manualVehicle",
                lookedUpVehicle: vehicle,
                selectedVehicleId: vehicle.id,
                specs,
                step: specsValidation.valid ? "servicing" : "specs",
                validation: specsValidation.valid ? null : specsValidation.reason ?? "Confirm vehicle specs before servicing."
              }));
            }}
            onAddVehicleForCustomer={() => {
              if (!state.selectedCustomer) {
                setState((current) => ({ ...current, validation: "Select or add a customer first." }));
                return;
              }
              setState((current) => ({
                ...current,
                activePopout: "addVehicle",
                lookedUpVehicle: null,
                selectedVehicleId: null,
                specs: { ...current.specs, vin: "", plate: "", mileage: "" },
                step: "specs",
                validation: "Customer selected. Add vehicle specs for this customer."
              }));
            }}
          />
        </StartTicketPopout>
      ) : null}
      {state.step === "customer" && !state.customerFirstFlow ? (
        <StartTicketPopout title="Select Customer" subtitle="Attach this vehicle to a customer before service selection." onClose={closeStartTicketPopout} closeOnBackdrop={false}>
          <CustomerFleetStep
            search={state.customerSearch}
            matches={state.customerMatches}
            selectedCustomer={state.selectedCustomer}
            form={state.customerForm}
            fleetEnabled={state.fleetEnabled}
            validation={state.validation}
            onSearchChange={(customerSearch) => setState((current) => ({ ...current, customerSearch }))}
            onSelectCustomer={(selectedCustomer) => setState((current) => ({ ...current, selectedCustomer, selectedCustomerId: selectedCustomer.id, validation: null }))}
            onFormChange={(customerForm) => setState((current) => ({ ...current, customerForm }))}
            onFleetChange={(fleetEnabled) => setState((current) => ({ ...current, fleetEnabled }))}
            onSaveCustomer={async () => {
              const form = state.customerForm;
              if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) {
                setState((current) => ({ ...current, validation: "First name, last name, and phone are required." }));
                notify({ tone: "error", title: "Customer details needed", message: "First name, last name, and phone are required." });
                return;
              }
              const customer = await createCustomer({
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                phone: form.phone.trim(),
                email: form.email.trim() || null,
                notes: form.notes.trim() || null,
                firebase_uid: null,
                referral_code: null
              });
              setState((current) => ({
                ...current,
                selectedCustomer: customer,
                selectedCustomerId: customer.id,
                customerForm: emptyCustomerForm,
                customerSearch: "",
                customerMatches: [],
                validation: null
              }));
              notify({ tone: "success", title: "Customer saved", message: `${customer.first_name} ${customer.last_name} selected.` });
            }}
            onPrevious={() => setState((current) => ({ ...current, activePopout: "manualVehicle", step: "specs", validation: null }))}
            onNext={() => {
              if (!validateCustomer()) return;
              setState((current) => ({ ...current, activePopout: null, step: "servicing", validation: null }));
            }}
          />
        </StartTicketPopout>
      ) : null}
      {state.step === "servicing" && !workflowPackage ? (
        <ServicingStep
          packages={packages}
          catalogItems={catalogItems}
          selectedPackage={state.selectedPackage}
          selectedCustomer={state.selectedCustomer}
          specs={state.specs}
          actualQuarts={state.actualQuarts}
          filterType={state.filterType}
          oilTypeOverride={state.oilTypeOverride}
          oilFilterSuggestion={state.oilFilterSuggestion}
          selectedOilFilter={state.selectedOilFilter}
          filterChoice={state.filterChoice}
          quartsSuggestionSource={state.quartsSuggestionSource}
          serviceDefaultsMessage={state.serviceDefaultsMessage}
          lines={state.selectedLines}
          customLine={state.customLine}
          customerConcern={state.customerConcern}
          technicianNotes={state.technicianNotes}
          internalNotes={state.internalNotes}
          pricing={calculatePackagePricing({
            selectedPackage: state.selectedPackage,
            actualQuarts: state.selectedPackage && getPackageCategory(state.selectedPackage) === "Oil Changes" ? Number(state.actualQuarts) || state.selectedPackage.included_quarts || 0 : 0,
            filterType: state.selectedPackage && getPackageCategory(state.selectedPackage) === "Oil Changes" ? state.filterType : "none",
            oilFilterPrice: !state.selectedPackage || getPackageCategory(state.selectedPackage) !== "Oil Changes" || state.filterChoice === "customer_supplied" || state.filterChoice === "no_filter" || state.filterChoice === "standard_unmatched"
              ? 0
              : Math.max(Number(state.selectedOilFilter?.retailPrice) || Number(state.selectedOilFilterRetailPrice) || 0, 0),
            oilFilterCost: state.selectedOilFilter?.cost ?? state.selectedOilFilterCost ?? undefined,
            oilFilterTaxable: 1,
            addons: state.selectedCatalogItems.map((line) => ({
              name: line.name,
              quantity: line.quantity,
              unit_price: line.unit_price,
              taxable: line.taxable,
              is_fee: line.item_type === "fee" ? 1 : 0,
              is_discount: line.item_type === "discount" ? 1 : 0
            })),
            taxRate: state.taxRate
          })}
          validation={state.validation}
          onSelectPackage={(selectedPackage) => {
            const isOilPackage = getPackageCategory(selectedPackage) === "Oil Changes";
            setWorkflowPackage(isOilPackage ? selectedPackage : null);
            setState((current) => ({
              ...current,
              selectedPackage: selectedPackage,
              selectedLines: isOilPackage
                ? current.selectedCatalogItems
                : buildPackageLines({
                    selectedPackage,
                    actualQuarts: "",
                    filterType: current.filterType,
                    selectedOilFilter: null,
                    filterChoice: null,
                    addOnLines: current.selectedCatalogItems,
                    taxRate: current.taxRate
                  }),
              actualQuarts: isOilPackage ? "" : current.actualQuarts,
              validation: null
            }));
            if (!isOilPackage) {
              notify({ tone: "success", title: "Service added", message: `${selectedPackage.name} added to ticket.` });
            }
          }}
          onActualQuartsChange={(actualQuarts) => syncLines({ actualQuarts })}
          onFilterTypeChange={(filterType) => {
            if (filterType === "customer_supplied") {
              setState((current) => ({
                ...current,
                filterType,
                selectedOilFilter: null,
                selectedOilFilterInventoryItemId: null,
                selectedOilFilterSku: null,
                selectedOilFilterName: "Customer supplied filter",
                selectedOilFilterBrand: null,
                selectedOilFilterRetailPrice: null,
                selectedOilFilterCost: null,
                selectedOilFilterSource: "customer_supplied",
                filterChoice: "customer_supplied",
                selectedLines: rebuildPackageLines({
                  selectedPackage: current.selectedPackage,
                  actualQuarts: current.actualQuarts,
                  filterType,
                  selectedOilFilter: null,
                  filterChoice: "customer_supplied",
                  addOnLines: current.selectedCatalogItems
                })
              }));
              return;
            }
            if (filterType === "none") {
              setState((current) => ({
                ...current,
                filterType,
                selectedOilFilter: null,
                selectedOilFilterInventoryItemId: null,
                selectedOilFilterSku: null,
                selectedOilFilterName: "No filter",
                selectedOilFilterBrand: null,
                selectedOilFilterRetailPrice: null,
                selectedOilFilterCost: null,
                selectedOilFilterSource: "no_filter",
                filterChoice: "no_filter",
                selectedLines: rebuildPackageLines({
                  selectedPackage: current.selectedPackage,
                  actualQuarts: current.actualQuarts,
                  filterType,
                  selectedOilFilter: null,
                  filterChoice: "no_filter",
                  addOnLines: current.selectedCatalogItems
                })
              }));
              return;
            }
            setState((current) => {
              const nextFilterChoice = current.filterChoice === "customer_supplied" || current.filterChoice === "no_filter" ? "standard_unmatched" : current.filterChoice;
              return {
                ...current,
                filterType,
                filterChoice: nextFilterChoice,
                selectedLines: rebuildPackageLines({
                  selectedPackage: current.selectedPackage,
                  actualQuarts: current.actualQuarts,
                  filterType,
                  selectedOilFilter: current.selectedOilFilter,
                  filterChoice: nextFilterChoice,
                  addOnLines: current.selectedCatalogItems
                })
              };
            });
          }}
          onOilTypeOverrideChange={(oilTypeOverride) => setState((current) => ({ ...current, oilTypeOverride, specs: { ...current.specs, oil_type: oilTypeOverride } }))}
          onUseSuggestedFilter={() => setState((current) => {
            const selected = current.oilFilterSuggestion?.source === "none" ? null : current.oilFilterSuggestion;
            return {
              ...current,
              selectedOilFilter: selected,
              selectedOilFilterInventoryItemId: selected?.inventoryItemId ?? null,
              selectedOilFilterSku: selected?.sku ?? selected?.productId ?? null,
              selectedOilFilterName: selected?.name ?? null,
              selectedOilFilterBrand: selected?.brand ?? null,
              selectedOilFilterRetailPrice: selected?.retailPrice ?? null,
              selectedOilFilterCost: selected?.cost ?? null,
              selectedOilFilterSource: selected?.source ?? null,
              filterChoice: selected ? "inventory" : "standard_unmatched",
              selectedLines: rebuildPackageLines({
                selectedPackage: current.selectedPackage,
                actualQuarts: current.actualQuarts,
                filterType: current.filterType,
                selectedOilFilter: selected,
                filterChoice: selected ? "inventory" : "standard_unmatched",
                addOnLines: current.selectedCatalogItems
              })
            };
          })}
          onOpenOilFilterSearch={() => {
            setFilterSearchOpen(true);
            setFilterSearchQuery("");
          }}
          onCustomerSuppliedFilter={() => setState((current) => ({
            ...current,
            selectedOilFilter: null,
            selectedOilFilterInventoryItemId: null,
            selectedOilFilterSku: null,
            selectedOilFilterName: "Customer supplied filter",
            selectedOilFilterBrand: null,
            selectedOilFilterRetailPrice: null,
            selectedOilFilterCost: null,
            selectedOilFilterSource: "customer_supplied",
            filterChoice: "customer_supplied",
            filterType: "customer_supplied",
            selectedLines: rebuildPackageLines({
              selectedPackage: current.selectedPackage,
              actualQuarts: current.actualQuarts,
              filterType: "customer_supplied",
              selectedOilFilter: null,
              filterChoice: "customer_supplied",
              addOnLines: current.selectedCatalogItems
            })
          }))}
          onNoFilter={() => setState((current) => ({
            ...current,
            selectedOilFilter: null,
            selectedOilFilterInventoryItemId: null,
            selectedOilFilterSku: null,
            selectedOilFilterName: "No filter",
            selectedOilFilterBrand: null,
            selectedOilFilterRetailPrice: null,
            selectedOilFilterCost: null,
            selectedOilFilterSource: "no_filter",
            filterChoice: "no_filter",
            filterType: "none",
            selectedLines: rebuildPackageLines({
              selectedPackage: current.selectedPackage,
              actualQuarts: current.actualQuarts,
              filterType: "none",
              selectedOilFilter: null,
              filterChoice: "no_filter",
              addOnLines: current.selectedCatalogItems
            })
          }))}
          onAddCatalogItem={addCatalogItem}
          onQuantityChange={(index, quantity) => setState((current) => {
            const target = current.selectedLines[index];
            if (!target || target.item_type === "package" || target.name === "Extra Oil Quarts" || target.name === "Cartridge Filter Fee") return current;
            const selectedCatalogItems = current.selectedCatalogItems.map((line) =>
              line === target || (line.service_id === target.service_id && line.name === target.name) ? { ...line, quantity: Math.max(quantity, 0.1) } : line
            );
            return {
              ...current,
              selectedCatalogItems,
              selectedLines: rebuildPackageLines({ selectedPackage: current.selectedPackage, actualQuarts: current.actualQuarts, filterType: current.filterType, addOnLines: selectedCatalogItems })
            };
          })}
          onPriceChange={(index, price) => setState((current) => {
            const target = current.selectedLines[index];
            if (!target || target.item_type === "package" || target.name === "Extra Oil Quarts" || target.name === "Cartridge Filter Fee") return current;
            const selectedCatalogItems = current.selectedCatalogItems.map((line) =>
              line === target || (line.service_id === target.service_id && line.name === target.name) ? { ...line, unit_price: Math.max(price, 0) } : line
            );
            return {
              ...current,
              selectedCatalogItems,
              selectedLines: rebuildPackageLines({ selectedPackage: current.selectedPackage, actualQuarts: current.actualQuarts, filterType: current.filterType, addOnLines: selectedCatalogItems })
            };
          })}
          onRemoveLine={(index) => setState((current) => {
            const target = current.selectedLines[index];
            if (!target) return current;
            if (target.item_type === "package") {
              return { ...current, selectedPackage: null, actualQuarts: "", filterType: "standard", selectedLines: current.selectedCatalogItems };
            }
            if (target.name === "Extra Oil Quarts" || target.name === "Cartridge Filter Fee") return current;
            const selectedCatalogItems = current.selectedCatalogItems.filter((line) => !(line.service_id === target.service_id && line.name === target.name));
            return {
              ...current,
              selectedCatalogItems,
              selectedLines: rebuildPackageLines({ selectedPackage: current.selectedPackage, actualQuarts: current.actualQuarts, filterType: current.filterType, addOnLines: selectedCatalogItems })
            };
          })}
          onCustomLineChange={(customLine) => setState((current) => ({ ...current, customLine }))}
          onAddCustomLine={addCustomLine}
          onNotesChange={(notes) => setState((current) => ({ ...current, ...notes }))}
          onPrevious={previousStep}
          onNext={() => {
            if (validateServices()) nextStep();
          }}
          onStartService={openBaySelection}
          onLookupVehicleInfo={() => setVehicleInfoLookupOpen(true)}
        />
      ) : null}
      {state.step === "order" ? (
        <OrderReviewStep
          specs={state.specs}
          selectedCustomer={state.selectedCustomer}
          customerForm={state.customerForm}
          lines={state.selectedLines}
          customerConcern={state.customerConcern}
          technicianNotes={state.technicianNotes}
          internalNotes={state.internalNotes}
          totals={totals}
          validation={state.validation}
          saving={saving}
          onPrevious={previousStep}
          onCreateOrder={createOrder}
        />
      ) : null}
    </OrderWizardShell>
    {bayModalOpen ? (
      <BaySelectionModal
        loading={saving}
        bayCounts={bayCounts}
        onCancel={() => setBayModalOpen(false)}
        onSelect={(bay) => void startServiceFromWizard(bay)}
      />
    ) : null}
    {stickerPreview ? (
      <WindowStickerPreview
        stickerData={stickerPreview.data}
        onSkip={() => {
          void Promise.all([
            updateWindowStickerStatus(stickerPreview.stickerId, "previewed"),
            stickerPreview.printJobId ? markPrintJobPreviewed(stickerPreview.printJobId) : Promise.resolve()
          ]).finally(() => onCreated(stickerPreview.ticketId));
        }}
        onMarkPrinted={() => {
          void Promise.all([
            updateWindowStickerStatus(stickerPreview.stickerId, "printed"),
            stickerPreview.printJobId ? markPrintJobPrinted(stickerPreview.printJobId) : Promise.resolve()
          ]).finally(() => onCreated(stickerPreview.ticketId));
        }}
      />
    ) : null}
    {filterSearchOpen ? (
      <OilFilterSearchModal
        query={filterSearchQuery}
        results={filterSearchResults}
        loading={filterSearchLoading}
        onQueryChange={setFilterSearchQuery}
        onClose={() => setFilterSearchOpen(false)}
        onSelect={(item) => {
          const selected = inventoryItemToOilFilterSuggestion(item);
          setState((current) => ({
            ...current,
            selectedOilFilter: selected,
            selectedOilFilterInventoryItemId: selected.inventoryItemId ?? null,
            selectedOilFilterSku: selected.sku ?? selected.productId ?? null,
            selectedOilFilterName: selected.name ?? null,
            selectedOilFilterBrand: selected.brand ?? null,
            selectedOilFilterRetailPrice: selected.retailPrice ?? null,
            selectedOilFilterCost: selected.cost ?? null,
            selectedOilFilterSource: "manual",
            filterChoice: "inventory",
            selectedLines: rebuildPackageLines({
              selectedPackage: current.selectedPackage,
              actualQuarts: current.actualQuarts,
              filterType: current.filterType,
              selectedOilFilter: selected,
              filterChoice: "inventory",
              addOnLines: current.selectedCatalogItems
            })
          }));
          if (import.meta.env.DEV) {
            console.info("[oil-filter-selected]", { vehicleId: state.selectedVehicleId ?? state.lookedUpVehicle?.id ?? null, filterId: selected.inventoryItemId ?? null, sku: selected.sku ?? selected.productId ?? null });
          }
          setFilterSearchOpen(false);
        }}
      />
    ) : null}
    <VehicleInfoLookupModal
      open={vehicleInfoLookupOpen}
      context={{
        vehicleId: state.selectedVehicleId ?? state.lookedUpVehicle?.id ?? null,
        vehicle: state.lookedUpVehicle,
        vin: state.specs.vin || state.vinInput || state.lookedUpVehicle?.vin,
        year: state.specs.year || state.lookedUpVehicle?.year,
        make: state.specs.make || state.lookedUpVehicle?.make,
        model: state.specs.model || state.lookedUpVehicle?.model,
        engine: state.specs.engine || state.lookedUpVehicle?.engine_model
      }}
      currentDefaults={{
        oil_type: state.specs.oil_type || state.oilTypeOverride || null,
        oil_capacity: Number(state.actualQuarts) || state.lookedUpVehicle?.oil_capacity || null,
        oil_filter_sku: state.selectedOilFilterSku ?? state.lookedUpVehicle?.oil_filter_sku ?? null,
        oil_filter_inventory_item_id: state.selectedOilFilterInventoryItemId ?? state.lookedUpVehicle?.oil_filter_inventory_item_id ?? null,
        air_filter_sku: state.lookedUpVehicle?.air_filter_sku ?? null,
        cabin_filter_sku: state.lookedUpVehicle?.cabin_filter_sku ?? null,
        vehicle_info_notes: state.lookedUpVehicle?.vehicle_info_notes ?? null,
        vehicle_info_source_url: state.lookedUpVehicle?.vehicle_info_source_url ?? null,
        vehicle_info_source_title: state.lookedUpVehicle?.vehicle_info_source_title ?? null
      }}
      onClose={() => setVehicleInfoLookupOpen(false)}
      onSaved={(defaults) => void applyVehicleInfoDefaultsToWizard(defaults)}
    />
    </>
  );
}
