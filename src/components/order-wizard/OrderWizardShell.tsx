import type { ReactNode } from "react";
import { WizardStepHeader } from "./WizardStepHeader";
import type { WizardStep } from "./orderWizardTypes";

interface OrderWizardShellProps {
  currentStep: WizardStep;
  children: ReactNode;
}

export function OrderWizardShell({ currentStep, children }: OrderWizardShellProps) {
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <WizardStepHeader currentStep={currentStep} />
      <div className="animate-[wizardFade_180ms_ease-out]">{children}</div>
    </section>
  );
}
