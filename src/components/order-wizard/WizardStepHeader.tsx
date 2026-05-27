import { Check } from "lucide-react";
import { wizardSteps } from "./orderWizardState";
import type { OrderWizardState, WizardStep } from "./orderWizardTypes";
import { getWizardStepStatus } from "./wizardNavigation";

interface WizardStepHeaderProps {
  currentStep: WizardStep;
  state: OrderWizardState;
  onStepClick: (step: WizardStep) => void;
}

export function WizardStepHeader({ currentStep, state, onStepClick }: WizardStepHeaderProps) {
  const currentIndex = wizardSteps.findIndex((step) => step.key === currentStep);

  return (
    <div className="w-full rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 shadow-sm">
      <div className="grid min-w-0 grid-cols-5 gap-1 overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)]">
        {wizardSteps.map((step, index) => {
          const active = step.key === currentStep;
          const status = getWizardStepStatus(step.key, state);
          const complete = status === "complete" || (index < currentIndex && status !== "blocked");
          const blocked = status === "blocked";
          const clickable = !blocked || active;
          return (
            <button
              type="button"
              key={step.key}
              aria-current={active ? "step" : undefined}
              aria-label={blocked ? `${step.label}: blocked until required information is complete` : `Go to ${step.label}`}
              title={blocked ? "Complete earlier requirements first" : `Go to ${step.label}`}
              onClick={() => onStepClick(step.key)}
              className={`relative flex min-w-0 items-center justify-center gap-2 px-2 py-3 text-center text-xs font-bold outline-none transition-all focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] md:text-sm ${
                active
                  ? "bg-[var(--pos-blue)] text-white shadow-sm pos-glow"
                  : complete
                    ? "bg-[var(--pos-blue-soft)] text-sky-100"
                    : blocked
                      ? "bg-[var(--pos-panel-2)] text-[var(--pos-muted-2)] opacity-60"
                      : "bg-[var(--pos-panel-2)] text-[var(--pos-muted)] hover:bg-[var(--pos-card-hover)] hover:text-[var(--pos-text)]"
              } ${clickable ? "cursor-pointer" : "cursor-not-allowed"}`}
              style={active && index < wizardSteps.length - 1 ? { clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)" } : undefined}
            >
              {complete ? <Check size={16} /> : null}
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-6 text-sm text-[var(--pos-muted)]">
        <span>Order ID: <strong className="text-[var(--pos-text)]">None</strong></span>
        <span>Last Update By: <strong className="text-[var(--pos-text)]">None</strong></span>
      </div>
    </div>
  );
}
