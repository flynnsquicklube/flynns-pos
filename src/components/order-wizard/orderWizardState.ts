import { useMemo, useState } from "react";
import { calculateTicketTotals } from "../../lib/utils/pricing";
import type { OrderWizardState, VehicleSpecsForm, WizardCustomerForm } from "./orderWizardTypes";

export const wizardSteps = [
  { key: "vehicle", label: "Vehicle" },
  { key: "specs", label: "Specs" },
  { key: "customer", label: "Customer/Fleet" },
  { key: "servicing", label: "Servicing" },
  { key: "order", label: "Order" }
] as const;

export const emptySpecs: VehicleSpecsForm = {
  year: "",
  make: "",
  model: "",
  trim: "",
  engine: "",
  drive_type: "",
  fuel_type: "",
  transmission_style: "",
  vin: "",
  plate: "",
  plate_state: "OH",
  mileage: "",
  oil_type: "",
  notes: ""
};

export const emptyCustomerForm: WizardCustomerForm = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  notes: ""
};

export function useOrderWizardState() {
  const [state, setState] = useState<OrderWizardState>({
    selectedStartingPoint: "vehicle",
    activePopout: null,
    customerFirstFlow: false,
    step: "vehicle",
    vehicleSubstep: "method",
    vehicleMethod: null,
    vinInput: "",
    plateInput: "",
    plateState: "OH",
    lookedUpVehicle: null,
    selectedVehicleId: null,
    specs: emptySpecs,
    customerSearch: "",
    customerMatches: [],
    selectedCustomer: null,
    selectedCustomerId: null,
    customerForm: emptyCustomerForm,
    fleetEnabled: false,
    selectedLines: [],
    selectedPackage: null,
    actualQuarts: "",
    filterType: "standard",
    oilTypeOverride: "",
    oilFilterSuggestion: null,
    selectedOilFilter: null,
    selectedOilFilterInventoryItemId: null,
    selectedOilFilterSku: null,
    selectedOilFilterName: null,
    selectedOilFilterBrand: null,
    selectedOilFilterRetailPrice: null,
    selectedOilFilterCost: null,
    selectedOilFilterSource: null,
    filterChoice: null,
    selectedOilInventoryItemId: null,
    selectedOilSku: null,
    selectedOilName: null,
    selectedOilSource: null,
    quartsSuggestionSource: null,
    serviceDefaultsMessage: null,
    selectedCatalogItems: [],
    customLine: { name: "", quantity: "1", unit_price: "", taxable: true },
    customerConcern: "",
    technicianNotes: "",
    internalNotes: "",
    taxRate: 0,
    validation: null
  });

  const totals = useMemo(() => calculateTicketTotals(state.selectedLines, state.taxRate), [state.selectedLines, state.taxRate]);

  return { state, setState, totals };
}
