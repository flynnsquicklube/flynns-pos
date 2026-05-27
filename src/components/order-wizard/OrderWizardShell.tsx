import type { ReactNode } from "react";
import { WizardStepHeader } from "./WizardStepHeader";
import type { OrderWizardState, WizardStep } from "./orderWizardTypes";

interface OrderWizardShellProps {
  currentStep: WizardStep;
  state: OrderWizardState;
  onStepClick: (step: WizardStep) => void;
  children: ReactNode;
}

export function OrderWizardShell({ currentStep, state, onStepClick, children }: OrderWizardShellProps) {
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <WizardStepHeader currentStep={currentStep} state={state} onStepClick={onStepClick} />
      <div className="animate-[wizardFade_180ms_ease-out]">{children}</div>
    </section>
  );
}
