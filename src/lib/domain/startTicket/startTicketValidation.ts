import { extractVinFromScannedText } from "../vehicles/vinUtils";
import { normalizePlate, normalizePlateState } from "../vehicles/plateUtils";
import type { OrderWizardState } from "../../../components/order-wizard/orderWizardTypes";
import type { TicketWithDetails } from "../../../types/ticket";
import { getPackageCategory } from "../packages/packageCategories";

export interface VehicleIdentifierDraft {
  vin?: string | null;
  plate?: string | null;
  plate_state?: string | null;
}

export interface StartTicketValidationResult {
  valid: boolean;
  message?: string;
  reason?: string;
  missingFields?: string[];
  fieldErrors?: Record<string, string>;
}

function invalid(message: string, missingFields: string[] = [], fieldErrors: Record<string, string> = {}): StartTicketValidationResult {
  return { valid: false, message, reason: message, missingFields, fieldErrors };
}

export function normalizeIdentifierDraft(vehicleDraft: VehicleIdentifierDraft): Required<VehicleIdentifierDraft> {
  const vinExtraction = extractVinFromScannedText(vehicleDraft.vin ?? "");
  return {
    vin: vinExtraction.isValid ? vinExtraction.candidate : (vehicleDraft.vin ?? "").trim().toUpperCase(),
    plate: normalizePlate(vehicleDraft.plate),
    plate_state: normalizePlateState(vehicleDraft.plate_state)
  };
}

export function validateVehicleIdentifier(vehicleDraft: VehicleIdentifierDraft): StartTicketValidationResult {
  const vinInput = (vehicleDraft.vin ?? "").trim();
  const plate = normalizePlate(vehicleDraft.plate);
  const plateState = normalizePlateState(vehicleDraft.plate_state);

  if (vinInput) {
    const extraction = extractVinFromScannedText(vinInput);
    if (!extraction.isValid || !extraction.candidate) {
      return invalid("VIN must be 17 characters and cannot contain I, O, or Q.", ["vin"], { vin: "Invalid VIN" });
    }
    return { valid: true };
  }

  if (plate) {
    if (!plateState) {
      return invalid("Select a plate state before continuing.", ["plate_state"], { plate_state: "Plate state required" });
    }
    return { valid: true };
  }

  return invalid("Enter either a VIN or a license plate before continuing.", ["vin", "plate"], { vin: "VIN or plate required", plate: "VIN or plate required" });
}

export function hasVehicleIdentifier(vehicleDraft: VehicleIdentifierDraft) {
  return validateVehicleIdentifier(vehicleDraft).valid;
}

export function validateStartTicketVehicleSpecs(vehicleDraft: VehicleIdentifierDraft & {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  mileage?: string | number | null;
}): StartTicketValidationResult {
  if (!String(vehicleDraft.year ?? "").trim() || !String(vehicleDraft.make ?? "").trim() || !String(vehicleDraft.model ?? "").trim() || !String(vehicleDraft.mileage ?? "").trim()) {
    return invalid("Year, make, model, and mileage are required before continuing.", ["year", "make", "model", "mileage"]);
  }
  return validateVehicleIdentifier(vehicleDraft);
}

export function validateCanLeaveVehicleStep(state: OrderWizardState): StartTicketValidationResult {
  if (state.customerFirstFlow && state.selectedCustomer) return { valid: true };
  if (state.vehicleMethod === "vin" && state.vinInput.trim()) return validateVehicleIdentifier({ vin: state.vinInput });
  if (state.vehicleMethod === "plate" && state.plateInput.trim()) return validateVehicleIdentifier({ plate: state.plateInput, plate_state: state.plateState });
  if (state.vehicleMethod === null && !state.specs.year.trim() && !state.specs.make.trim() && !state.specs.model.trim()) {
    return invalid("Choose Customer / Phone, VIN, License Plate, or Manual Entry to start the ticket.", ["vehicleMethod"]);
  }
  return { valid: true };
}

export function validateCanLeaveSpecsStep(state: OrderWizardState): StartTicketValidationResult {
  return validateStartTicketVehicleSpecs(state.specs);
}

export function validateCanLeaveCustomerStep(state: OrderWizardState): StartTicketValidationResult {
  if (state.selectedCustomer || state.selectedCustomerId) return { valid: true };
  const form = state.customerForm;
  if (form.first_name.trim() && form.last_name.trim() && form.phone.trim()) return { valid: true };
  return invalid("Select or add a customer before servicing.", ["customer"]);
}

export function validateCanEnterServicing(state: OrderWizardState): StartTicketValidationResult {
  const specs = validateCanLeaveSpecsStep(state);
  if (!specs.valid) return specs;
  const customer = validateCanLeaveCustomerStep(state);
  if (!customer.valid) return customer;
  return { valid: true };
}

export function validateCanSendToBay(state: OrderWizardState): StartTicketValidationResult {
  const servicing = validateCanEnterServicing(state);
  if (!servicing.valid) return servicing;
  if (!state.selectedLines.length && !state.selectedCatalogItems.length) {
    return invalid("Select a package or service before sending to bay.", ["services"]);
  }
  if (state.selectedPackage && getPackageCategory(state.selectedPackage) === "Oil Changes") {
    const actualQuarts = Number(state.actualQuarts);
    if (!Number.isFinite(actualQuarts) || actualQuarts <= 0) {
      return invalid("Enter valid oil quarts before sending to bay.", ["actualQuarts"]);
    }
    const filterConfirmed =
      state.filterChoice === "customer_supplied" ||
      state.filterChoice === "no_filter" ||
      Boolean(state.selectedOilFilterInventoryItemId);
    if (!filterConfirmed) {
      return invalid("Select an oil filter or choose customer supplied/no filter.", ["oilFilter"]);
    }
  }
  return { valid: true };
}

export function validateCanFinalizeTicket(ticket: TicketWithDetails | null): StartTicketValidationResult {
  if (!ticket) return invalid("Ticket not found.");
  if (ticket.status === "completed") return invalid("Ticket is already finalized.");
  if (ticket.status === "canceled") return invalid("Canceled tickets cannot be finalized.");
  if (ticket.payment_status !== "paid") return invalid("Add payment before finalizing.");
  if (!ticket.customer_id) return invalid("Ticket must have a customer before finalizing.");
  if (!ticket.vehicle_id) return invalid("Ticket must have a vehicle before finalizing.");
  return { valid: true };
}
