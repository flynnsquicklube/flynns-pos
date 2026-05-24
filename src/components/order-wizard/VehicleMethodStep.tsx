import { BadgeCheck, CarFront, Keyboard } from "lucide-react";
import { Card } from "../ui/Card";

interface VehicleMethodStepProps {
  onSelectVin: () => void;
  onSelectPlate: () => void;
  onSelectManual: () => void;
}

export function VehicleMethodStep({ onSelectVin, onSelectPlate, onSelectManual }: VehicleMethodStepProps) {
  const options = [
    { label: "VIN", helper: "Scan or type the VIN barcode.", icon: BadgeCheck, onClick: onSelectVin },
    { label: "License Plate", helper: "Search by plate and state.", icon: CarFront, onClick: onSelectPlate },
    { label: "Manual Entry", helper: "Enter year, make, model, and mileage.", icon: Keyboard, onClick: onSelectManual }
  ];

  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <Card className="w-full max-w-4xl p-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-950">Choose Vehicle Identification Method</h1>
          <p className="mt-2 text-sm text-slate-500">Start with the fastest identifier available at the service counter.</p>
        </div>
        <div className="mx-auto mt-9 grid max-w-4xl gap-5 md:grid-cols-3">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button key={option.label} onClick={option.onClick} className="rounded-2xl border border-[var(--brand-border)] bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-light)] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-primary-light)]">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--brand-primary-light)] text-[var(--brand-primary)]">
                  <Icon size={40} />
                </div>
                <div className="mt-5 text-xl font-bold text-slate-950">{option.label}</div>
                <div className="mt-2 text-sm text-slate-500">{option.helper}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
