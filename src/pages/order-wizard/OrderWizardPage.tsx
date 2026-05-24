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
import { VehicleMethodStep } from "../../components/order-wizard/VehicleMethodStep";
import { VinLookupStep } from "../../components/order-wizard/VinLookupStep";
import { emptyCustomerForm, useOrderWizardState } from "../../components/order-wizard/orderWizardState";
import type { VehicleSpecsForm, WizardStep } from "../../components/order-wizard/orderWizardTypes";
import { listActiveCatalogItems } from "../../lib/db/repositories/catalogRepo";
import { createCustomer, getCustomer, searchCustomers } from "../../lib/db/repositories/customersRepo";
import { listActivePackages } from "../../lib/db/repositories/packagesRepo";
import { getSetting } from "../../lib/db/repositories/settingsRepo";
import { createTicketWithItems, listActiveTickets, startService } from "../../lib/db/repositories/ticketsRepo";
import { createWindowSticker, updateWindowStickerStatus } from "../../lib/db/repositories/windowStickersRepo";
import { createVehicle, getVehicleById, searchVehicles, updateVehicle } from "../../lib/db/repositories/vehiclesRepo";
import { searchOilFilters } from "../../lib/db/repositories/inventoryRepo";
import { buildWindowStickerData, type WindowStickerPrintData } from "../../lib/domain/stickers/windowStickerBuilder";
import { getVehicleOilChangeDefaults } from "../../lib/domain/vehicles/vehicleServiceDefaults";
import { buildOilChangePackageLines } from "../../lib/domain/packages/packageWorkflow";
import { suggestEngineOil, type OilSelectionSuggestion } from "../../lib/domain/services/oilSelection";
import { calculatePackagePricing } from "../../lib/utils/pricing";
import { consumeStartTicketContext } from "../../lib/domain/startTicket/startTicketContext";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import type { TicketLineInput } from "../../types/ticket";
import { useToast } from "../../components/ui/useToast";
import { WindowStickerPreview } from "../../components/stickers/WindowStickerPreview";
import type { Customer } from "../../types/customer";
import type { Vehicle } from "../../types/vehicle";
import type { InventoryItem } from "../../types/inventory";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";

interface OrderWizardPageProps {
  onCreated: (ticketId: string) => void;
  onBackToStart?: () => void;
}

const stepOrder: WizardStep[] = ["vehicle", "specs", "customer", "servicing", "order"];

function buildPackageLines(input: {
  selectedPackage: ServicePackage | null;
  actualQuarts: string;
  filterType: PackageFilterType;
  addOnLines: TicketLineInput[];
  taxRate: number;
}): TicketLineInput[] {
  const actualQuarts = Number(input.actualQuarts) || 0;
  const packagePricing = calculatePackagePricing({
    selectedPackage: input.selectedPackage,
    actualQuarts,
    filterType: input.filterType,
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
      unit_price: input.selectedPackage.base_price,
      taxable: input.selectedPackage.taxable
    });
    if (packagePricing.extraQuartTotal > 0) {
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
    if (packagePricing.filterFee > 0) {
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
    engine: "",
    vin: vehicle.vin ?? "",
    plate: vehicle.plate ?? "",
    plate_state: vehicle.plate_state ?? "OH",
    mileage: vehicle.mileage ? String(vehicle.mileage) : "",
    oil_type: vehicle.oil_type ?? "",
    notes: vehicle.notes ?? ""
  };
}

export function OrderWizardPage({ onCreated, onBackToStart }: OrderWizardPageProps) {
  const { state, setState, totals } = useOrderWizardState();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [bayModalOpen, setBayModalOpen] = useState(false);
  const [bayCounts, setBayCounts] = useState({ bay1: 0, bay2: 0 });
  const [stickerPreview, setStickerPreview] = useState<{ stickerId: string; ticketId: string; data: WindowStickerPrintData } | null>(null);
  const [filterSearchOpen, setFilterSearchOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [filterSearchResults, setFilterSearchResults] = useState<InventoryItem[]>([]);
  const [filterSearchLoading, setFilterSearchLoading] = useState(false);
  const [workflowPackage, setWorkflowPackage] = useState<ServicePackage | null>(null);
  const { notify } = useToast();

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
    searchCustomers(state.customerSearch)
      .then((matches) => setState((current) => ({ ...current, customerMatches: matches })))
      .catch((error: unknown) => setState((current) => ({ ...current, validation: error instanceof Error ? error.message : "Unable to search customers." })));
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
            selectedOilFilterSource: current.selectedOilFilterSource ?? (defaults.oilFilter.source !== "none" ? defaults.oilFilter.source : null),
            filterChoice: current.filterChoice ?? (defaults.oilFilter.source !== "none" ? "suggested" : null),
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
    if (state.vehicleMethod === "vin" && normalizedQuery && normalizedQuery.length !== 17) {
      setState((current) => ({ ...current, validation: "VINs are usually 17 characters. You can still continue manually." }));
    }
    const matches = await searchVehicles(query);
    const match = matches[0] ?? null;
    if (!match) {
      setState((current) => ({ ...current, validation: notFoundMessage, specs: { ...current.specs, vin: current.vinInput || current.specs.vin, plate: current.plateInput || current.specs.plate, plate_state: current.plateState } }));
      goToStep("specs");
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
      specs: specsFromVehicle(match),
      validation: null,
      step: "specs"
    }));
  };

  const validateSpecs = () => {
    if (!state.specs.year || !state.specs.make.trim() || !state.specs.model.trim() || !state.specs.mileage) {
      setState((current) => ({ ...current, validation: "Year, make, model, and mileage are required before continuing." }));
      notify({ tone: "error", title: "Vehicle specs needed", message: "Enter year, make, model, and mileage." });
      return false;
    }
    return true;
  };

  const validateCustomer = () => {
    if (state.selectedCustomer) return true;
    if (!state.customerForm.first_name.trim() || !state.customerForm.last_name.trim() || !state.customerForm.phone.trim()) {
      setState((current) => ({ ...current, validation: "Select a customer or enter first name, last name, and phone." }));
      notify({ tone: "error", title: "Customer needed", message: "Select a customer or enter first name, last name, and phone." });
      return false;
    }
    return true;
  };

  const validateServices = () => {
    if (state.selectedPackage && (!Number.isFinite(Number(state.actualQuarts)) || Number(state.actualQuarts) <= 0)) {
      setState((current) => ({ ...current, validation: "Enter actual quarts before continuing." }));
      notify({ tone: "error", title: "Quarts needed", message: "Actual quarts must be greater than zero." });
      return false;
    }
    if (state.selectedLines.length === 0) {
      setState((current) => ({ ...current, validation: "Add at least one service or custom item before continuing." }));
      notify({ tone: "error", title: "Service needed", message: "Add at least one service or custom item." });
      return false;
    }
    return true;
  };

  const rebuildPackageLines = (next: {
    selectedPackage: ServicePackage | null;
    actualQuarts: string;
    filterType: PackageFilterType;
    addOnLines: TicketLineInput[];
  }) => buildPackageLines({ ...next, taxRate: state.taxRate });

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
      addons: [],
      taxRate: state.taxRate
    });
    return {
      package_id: state.selectedPackage.id,
      package_name: state.selectedPackage.name,
      oil_brand: state.selectedPackage.oil_brand,
      oil_type: state.oilTypeOverride.trim() || state.specs.oil_type || state.selectedPackage.oil_type,
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
      package_base_price: state.selectedPackage.base_price,
      package_total: pricing.packageBase + pricing.extraQuartTotal + pricing.filterFee
    };
  };

  const persistOrder = async (): Promise<{ ticketId: string; customer: Customer; vehicle: Vehicle } | null> => {
    if (!validateSpecs() || !validateCustomer() || !validateServices()) return null;
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
      vin: state.specs.vin.trim() || null,
      plate: state.specs.plate.trim() || null,
      plate_state: state.specs.plate_state.trim() || null,
      year: Number(state.specs.year),
      make: state.specs.make.trim(),
      model: state.specs.model.trim(),
      mileage: Number(state.specs.mileage),
      oil_type: state.oilTypeOverride.trim() || state.specs.oil_type.trim() || null,
      notes: [state.specs.engine ? `Engine: ${state.specs.engine}` : "", state.specs.notes].filter(Boolean).join(" | ") || null
    };
    const vehicle = state.lookedUpVehicle ?? (await createVehicle(vehicleInput));
    if (state.lookedUpVehicle) await updateVehicle(state.lookedUpVehicle.id, vehicleInput);
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
    if (!validateSpecs() || !validateCustomer() || !validateServices()) return;
    const activeTickets = await listActiveTickets();
    setBayCounts({
      bay1: activeTickets.filter((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 1").length,
      bay2: activeTickets.filter((ticket) => ticket.status === "in_service" && ticket.bay === "Bay 2").length
    });
    setBayModalOpen(true);
  };

  const startServiceFromWizard = async (bay: "Bay 1" | "Bay 2") => {
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
      setBayModalOpen(false);
      setStickerPreview({ stickerId: sticker.id, ticketId: result.ticketId, data: stickerData });
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

  return (
    <>
    <OrderWizardShell currentStep={state.step}>
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
          onFilterTypeChange={(filterType) => setState((current) => ({ ...current, filterType }))}
          onOilTypeOverrideChange={(oilTypeOverride) => setState((current) => ({ ...current, oilTypeOverride, specs: { ...current.specs, oil_type: oilTypeOverride } }))}
          onUseFilter={(filter, choice) => setState((current) => ({
            ...current,
            selectedOilFilter: filter,
            selectedOilFilterInventoryItemId: filter.inventoryItemId ?? null,
            selectedOilFilterSku: filter.sku ?? filter.productId ?? null,
            selectedOilFilterName: filter.name ?? null,
            selectedOilFilterSource: filter.source,
            filterChoice: choice
          }))}
          onCustomerSuppliedFilter={() => setState((current) => ({
            ...current,
            selectedOilFilter: null,
            selectedOilFilterInventoryItemId: null,
            selectedOilFilterSku: null,
            selectedOilFilterName: "Customer supplied filter",
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
          onSelectVin={() => setState((current) => ({ ...current, vehicleMethod: "vin", vehicleSubstep: "vin", validation: null }))}
          onSelectPlate={() => setState((current) => ({ ...current, vehicleMethod: "plate", vehicleSubstep: "plate", validation: null }))}
          onSelectManual={() => goToStep("specs")}
        />
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "vin" ? (
        <VinLookupStep
          vin={state.vinInput}
          validation={state.validation}
          onChange={(vinInput) => setState((current) => ({ ...current, vinInput, specs: { ...current.specs, vin: vinInput } }))}
          onBack={() => setState((current) => ({ ...current, vehicleSubstep: "method", validation: null }))}
          onSearch={() => void applyVehicleLookup(state.vinInput, "No local VIN match found. Continue with manual specs.")}
          onContinue={() => setState((current) => ({ ...current, specs: { ...current.specs, vin: current.vinInput || current.specs.vin }, step: "specs", validation: null }))}
        />
      ) : null}
      {state.step === "vehicle" && state.vehicleSubstep === "plate" ? (
        <PlateLookupStep
          plate={state.plateInput}
          plateState={state.plateState}
          validation={state.validation}
          onPlateChange={(plateInput) => setState((current) => ({ ...current, plateInput, specs: { ...current.specs, plate: plateInput } }))}
          onStateChange={(plateState) => setState((current) => ({ ...current, plateState, specs: { ...current.specs, plate_state: plateState } }))}
          onBack={() => setState((current) => ({ ...current, vehicleSubstep: "method", validation: null }))}
          onSearch={() => void applyVehicleLookup(state.plateInput, "No local plate match found. Continue with manual specs.")}
          onContinue={() => setState((current) => ({ ...current, specs: { ...current.specs, plate: current.plateInput || current.specs.plate, plate_state: current.plateState }, step: "specs", validation: null }))}
        />
      ) : null}
      {state.step === "specs" ? (
        <SpecsStep
          specs={state.specs}
          validation={state.validation}
          onChange={(specs) => setState((current) => ({ ...current, specs }))}
          onPrevious={() => goToStep("vehicle")}
          onNext={() => {
            if (!validateSpecs()) return;
            if (state.customerFirstFlow && state.selectedCustomer) {
              goToStep("servicing");
              return;
            }
            nextStep();
          }}
        />
      ) : null}
      {state.step === "customer" && state.customerFirstFlow ? (
        <CustomerSearchStep
          selectedCustomer={state.selectedCustomer}
          selectedVehicleId={state.selectedVehicleId}
          validation={state.validation}
          onBack={() => onBackToStart ? onBackToStart() : goToStep("vehicle")}
          onSelectCustomer={(selectedCustomer) => setState((current) => ({
            ...current,
            selectedCustomer,
            selectedCustomerId: selectedCustomer.id,
            customerForm: emptyCustomerForm,
            validation: null
          }))}
          onUseVehicle={(vehicle) => {
            const specs = specsFromVehicle(vehicle);
            const hasRequiredSpecs = Boolean(specs.year && specs.make && specs.model && specs.mileage);
            setState((current) => ({
              ...current,
              lookedUpVehicle: vehicle,
              selectedVehicleId: vehicle.id,
              specs,
              step: hasRequiredSpecs ? "servicing" : "specs",
              validation: null
            }));
          }}
          onAddVehicleForCustomer={() => {
            if (!state.selectedCustomer) {
              setState((current) => ({ ...current, validation: "Select or add a customer first." }));
              return;
            }
            setState((current) => ({
              ...current,
              lookedUpVehicle: null,
              selectedVehicleId: null,
              specs: { ...current.specs, vin: "", plate: "", mileage: "" },
              step: "specs",
              validation: "Customer selected. Add vehicle specs for this customer."
            }));
          }}
        />
      ) : null}
      {state.step === "customer" && !state.customerFirstFlow ? (
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
          onPrevious={previousStep}
          onNext={() => {
            if (validateCustomer()) nextStep();
          }}
        />
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
            actualQuarts: Number(state.actualQuarts) || state.selectedPackage?.included_quarts || 0,
            filterType: state.filterType,
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
            setWorkflowPackage(selectedPackage);
            setState((current) => ({
              ...current,
              selectedPackage: selectedPackage,
              selectedLines: current.selectedCatalogItems,
              actualQuarts: "",
              validation: null
            }));
          }}
          onActualQuartsChange={(actualQuarts) => syncLines({ actualQuarts })}
          onFilterTypeChange={(filterType) => syncLines({ filterType })}
          onOilTypeOverrideChange={(oilTypeOverride) => setState((current) => ({ ...current, oilTypeOverride, specs: { ...current.specs, oil_type: oilTypeOverride } }))}
          onUseSuggestedFilter={() => setState((current) => {
            const selected = current.oilFilterSuggestion?.source === "none" ? null : current.oilFilterSuggestion;
            return {
              ...current,
              selectedOilFilter: selected,
              selectedOilFilterInventoryItemId: selected?.inventoryItemId ?? null,
              selectedOilFilterSku: selected?.sku ?? selected?.productId ?? null,
              selectedOilFilterName: selected?.name ?? null,
              selectedOilFilterSource: selected?.source ?? null,
              filterChoice: selected ? "suggested" : null
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
            selectedOilFilterSource: "no_filter",
            filterChoice: "no_filter",
            filterType: "none"
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
          onSaveDraft={() => setState((current) => ({ ...current, validation: "Draft saving is reserved for a later step. Use Check In / Create Order to save locally now." }))}
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
          void updateWindowStickerStatus(stickerPreview.stickerId, "previewed").finally(() => onCreated(stickerPreview.ticketId));
        }}
        onMarkPrinted={() => {
          void updateWindowStickerStatus(stickerPreview.stickerId, "printed").finally(() => onCreated(stickerPreview.ticketId));
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
            selectedOilFilterSource: "manual",
            filterChoice: "manual"
          }));
          if (import.meta.env.DEV) {
            console.info("[oil-filter-selected]", { vehicleId: state.selectedVehicleId ?? state.lookedUpVehicle?.id ?? null, filterId: selected.inventoryItemId ?? null, sku: selected.sku ?? selected.productId ?? null });
          }
          setFilterSearchOpen(false);
        }}
        onAddAsLine={(item) => {
          const selected = inventoryItemToOilFilterSuggestion(item);
          const line: TicketLineInput = {
            service_id: null,
            item_type: "inventory",
            package_id: state.selectedPackage?.id ?? null,
            inventory_item_id: item.id,
            cost: item.cost,
            sku: item.sku,
            product_id: item.product_id,
            source_price_type: "retail",
            name: item.name,
            quantity: 1,
            unit_price: item.retail_price,
            taxable: 1
          };
          setState((current) => {
            const selectedCatalogItems = [...current.selectedCatalogItems, line];
            return {
              ...current,
              selectedOilFilter: selected,
              selectedOilFilterInventoryItemId: selected.inventoryItemId ?? null,
              selectedOilFilterSku: selected.sku ?? selected.productId ?? null,
              selectedOilFilterName: selected.name ?? null,
              selectedOilFilterSource: "manual",
              filterChoice: "manual",
              selectedCatalogItems,
              selectedLines: buildPackageLines({
                selectedPackage: current.selectedPackage,
                actualQuarts: current.actualQuarts,
                filterType: current.filterType,
                addOnLines: selectedCatalogItems,
                taxRate: current.taxRate
              })
            };
          });
          setFilterSearchOpen(false);
        }}
      />
    ) : null}
    </>
  );
}
