import { Check } from "lucide-react";
import { wizardSteps } from "./orderWizardState";
import type { WizardStep } from "./orderWizardTypes";

interface WizardStepHeaderProps {
  currentStep: WizardStep;
}

export function WizardStepHeader({ currentStep }: WizardStepHeaderProps) {
  const currentIndex = wizardSteps.findIndex((step) => step.key === currentStep);

  return (
    <div className="w-full rounded-xl border border-[var(--brand-border)] bg-white p-4 shadow-sm">
      <div className="grid min-w-0 grid-cols-5 gap-1 overflow-hidden rounded-lg border border-[var(--brand-border)] bg-slate-100">
        {wizardSteps.map((step, index) => {
          const active = step.key === currentStep;
          const complete = index < currentIndex;
          return (
            <div
              key={step.key}
              className={`relative flex min-w-0 items-center justify-center gap-2 px-2 py-3 text-center text-xs font-bold transition-all md:text-sm ${
                active
                  ? "bg-[var(--brand-primary)] text-white shadow-sm"
                  : complete
                    ? "bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]"
                    : "bg-slate-100 text-[var(--brand-muted)]"
              }`}
              style={active && index < wizardSteps.length - 1 ? { clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)" } : undefined}
            >
              {complete ? <Check size={16} /> : null}
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-500">
        <span>Order ID: <strong className="text-slate-800">None</strong></span>
        <span>Last Update By: <strong className="text-slate-800">None</strong></span>
      </div>
    </div>
  );
}
