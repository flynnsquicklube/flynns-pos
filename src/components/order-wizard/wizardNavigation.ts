import { wizardSteps } from "./orderWizardState";
import { validateStartTicketVehicleSpecs, validateVehicleIdentifier } from "../../lib/domain/startTicket/startTicketValidation";
import type { OrderWizardState, WizardStep } from "./orderWizardTypes";

export type WizardStepStatus = "available" | "current" | "complete" | "blocked" | "warning";

function stepIndex(step: WizardStep) {
  return wizardSteps.findIndex((item) => item.key === step);
}

export function hasVehicleStarted(state: OrderWizardState) {
  return Boolean(
    state.selectedVehicleId ||
    state.lookedUpVehicle ||
    state.vehicleMethod ||
    state.vinInput.trim() ||
    state.plateInput.trim() ||
    state.specs.year.trim() ||
    state.specs.make.trim() ||
    state.specs.model.trim() ||
    state.specs.vin.trim() ||
    state.specs.plate.trim()
  );
}

export function hasValidSpecs(state: OrderWizardState) {
  return validateStartTicketVehicleSpecs(state.specs).valid;
}

export function hasValidVehicleIdentifier(state: OrderWizardState) {
  return validateVehicleIdentifier(state.specs).valid;
}

export function hasCustomer(state: OrderWizardState) {
  return Boolean(state.selectedCustomer || state.selectedCustomerId);
}

export function hasValidServiceSelection(state: OrderWizardState) {
  if (state.selectedPackage) {
    const actualQuarts = Number(state.actualQuarts);
    const hasQuarts = Number.isFinite(actualQuarts) && actualQuarts > 0;
    const filterConfirmed =
      state.filterChoice === "customer_supplied" ||
      state.filterChoice === "no_filter" ||
      Boolean(state.selectedOilFilterInventoryItemId);
    if (!hasQuarts || !filterConfirmed) return false;
  }
  return state.selectedLines.length > 0 || state.selectedCatalogItems.length > 0;
}

export function getBlockedStepReason(step: WizardStep, state: OrderWizardState) {
  if (step === "customer" && (hasVehicleStarted(state) || state.step === "specs") && !hasValidVehicleIdentifier(state)) {
    return validateVehicleIdentifier(state.specs).reason ?? "Enter either a VIN or a license plate before continuing.";
  }
  if (step === "servicing") {
    if (!hasValidSpecs(state)) return "Finish vehicle specs before servicing.";
    if (!hasCustomer(state)) return "Select a customer before servicing.";
  }
  if (step === "order") {
    if (!hasValidSpecs(state)) return "Finish vehicle specs before reviewing order.";
    if (!hasCustomer(state)) return "Select a customer before reviewing order.";
    if (!hasValidServiceSelection(state)) return "Select a package or service before reviewing order.";
  }
  return null;
}

export function canNavigateToStep(step: WizardStep, state: OrderWizardState) {
  if (step === state.step) return true;
  if (stepIndex(step) < stepIndex(state.step)) return true;
  if (step === "vehicle" || step === "specs") return true;
  if (step === "customer") return !getBlockedStepReason(step, state);
  return !getBlockedStepReason(step, state);
}

export function getWizardStepStatus(step: WizardStep, state: OrderWizardState): WizardStepStatus {
  if (step === state.step) return "current";
  if (!canNavigateToStep(step, state)) return "blocked";

  if (step === "vehicle") return hasVehicleStarted(state) ? "complete" : "available";
  if (step === "specs") return hasValidSpecs(state) ? "complete" : "available";
  if (step === "customer") return hasCustomer(state) ? "complete" : "available";
  if (step === "servicing") return hasValidServiceSelection(state) ? "complete" : "available";
  if (step === "order") return hasValidServiceSelection(state) && hasValidSpecs(state) && hasCustomer(state) ? "available" : "warning";

  return "available";
}

export function getNextValidStep(currentStep: WizardStep, state: OrderWizardState): WizardStep {
  const currentIndex = stepIndex(currentStep);
  for (const next of wizardSteps.slice(currentIndex + 1)) {
    if (canNavigateToStep(next.key, state)) return next.key;
  }
  return currentStep;
}
