import type { Customer, CustomerInput } from "../../types/customer";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import type { TicketLineInput } from "../../types/ticket";
import type { Vehicle } from "../../types/vehicle";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";

export type WizardStep = "vehicle" | "specs" | "customer" | "servicing" | "order";
export type VehicleMethod = "vin" | "plate" | null;
export type VehicleSubstep = "method" | "vin" | "plate";

export interface VehicleSpecsForm {
  year: string;
  make: string;
  model: string;
  engine: string;
  vin: string;
  plate: string;
  plate_state: string;
  mileage: string;
  oil_type: string;
  notes: string;
}

export interface WizardCustomerForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface CustomLineForm {
  name: string;
  quantity: string;
  unit_price: string;
  taxable: boolean;
}

export interface OrderWizardState {
  selectedStartingPoint: "vehicle" | "customer" | "manual";
  customerFirstFlow: boolean;
  step: WizardStep;
  vehicleSubstep: VehicleSubstep;
  vehicleMethod: VehicleMethod;
  vinInput: string;
  plateInput: string;
  plateState: string;
  lookedUpVehicle: Vehicle | null;
  selectedVehicleId: string | null;
  specs: VehicleSpecsForm;
  customerSearch: string;
  customerMatches: Customer[];
  selectedCustomer: Customer | null;
  selectedCustomerId: string | null;
  customerForm: WizardCustomerForm;
  fleetEnabled: boolean;
  selectedLines: TicketLineInput[];
  selectedPackage: ServicePackage | null;
  actualQuarts: string;
  filterType: PackageFilterType;
  oilTypeOverride: string;
  oilFilterSuggestion: OilFilterSuggestion | null;
  selectedOilFilter: OilFilterSuggestion | null;
  selectedOilFilterInventoryItemId: string | null;
  selectedOilFilterSku: string | null;
  selectedOilFilterName: string | null;
  selectedOilFilterSource: string | null;
  filterChoice: "suggested" | "manual" | "customer_supplied" | "no_filter" | null;
  selectedOilInventoryItemId: string | null;
  selectedOilSku: string | null;
  selectedOilName: string | null;
  selectedOilSource: "vehicle_default" | "last_service" | "package_default" | "manual" | "none" | null;
  quartsSuggestionSource: "vehicle_default" | "last_service" | "package_default" | null;
  serviceDefaultsMessage: string | null;
  selectedCatalogItems: TicketLineInput[];
  customLine: CustomLineForm;
  customerConcern: string;
  technicianNotes: string;
  internalNotes: string;
  taxRate: number;
  validation: string | null;
}

export type NewCustomerPayload = CustomerInput;
