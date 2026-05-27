import { BadgeCheck, CarFront, Keyboard, UserSearch } from "lucide-react";
import { Card } from "../ui/Card";

interface VehicleMethodStepProps {
  onSelectCustomer: () => void;
  onSelectVin: () => void;
  onSelectPlate: () => void;
  onSelectManual: () => void;
}

const options = [
  {
    label: "Customer / Phone",
    helper: "Find by name, phone, email, VIN, or plate.",
    icon: UserSearch,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    hoverBorder: "hover:border-cyan-400",
    hoverBg: "hover:bg-cyan-50",
    focusRing: "focus-visible:ring-cyan-200",
    accentBar: "border-t-4 border-t-cyan-400",
    key: "customer"
  },
  {
    label: "VIN",
    helper: "Scan or type the VIN barcode.",
    icon: BadgeCheck,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    hoverBorder: "hover:border-indigo-400",
    hoverBg: "hover:bg-indigo-50",
    focusRing: "focus-visible:ring-indigo-200",
    accentBar: "border-t-4 border-t-indigo-500",
    key: "vin"
  },
  {
    label: "License Plate",
    helper: "Search by plate and state.",
    icon: CarFront,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    hoverBorder: "hover:border-amber-400",
    hoverBg: "hover:bg-amber-50",
    focusRing: "focus-visible:ring-amber-200",
    accentBar: "border-t-4 border-t-amber-400",
    key: "plate"
  },
  {
    label: "Manual Entry",
    helper: "Enter year, make, model, and mileage.",
    icon: Keyboard,
    iconBg: "bg-[var(--pos-panel-2)]",
    iconColor: "text-[var(--pos-muted)]",
    hoverBorder: "hover:border-[var(--pos-border-strong)]",
    hoverBg: "hover:bg-[var(--pos-panel-2)]",
    focusRing: "focus-visible:ring-[var(--pos-blue-soft)]",
    accentBar: "border-t-4 border-t-[var(--pos-border-strong)]",
    key: "manual"
  }
] as const;

export function VehicleMethodStep({ onSelectCustomer, onSelectVin, onSelectPlate, onSelectManual }: VehicleMethodStepProps) {
  const handlers: Record<string, () => void> = {
    customer: onSelectCustomer,
    vin: onSelectVin,
    plate: onSelectPlate,
    manual: onSelectManual
  };

  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <Card className="w-full max-w-4xl p-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--pos-text)]">Choose a Starting Point</h1>
          <p className="mt-2 text-sm text-[var(--pos-muted)]">Start with the fastest information available at the service counter.</p>
        </div>
        <div className="mx-auto mt-9 grid max-w-4xl gap-5 md:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.key}
                onClick={handlers[option.key]}
                className={`rounded-2xl border border-[var(--pos-border)] bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 ${option.accentBar} ${option.hoverBorder} ${option.hoverBg} ${option.focusRing}`}
              >
                <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl ${option.iconBg} ${option.iconColor}`}>
                  <Icon size={40} />
                </div>
                <div className="mt-5 text-xl font-bold text-[var(--pos-text)]">{option.label}</div>
                <div className="mt-2 text-sm text-[var(--pos-muted)]">{option.helper}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
