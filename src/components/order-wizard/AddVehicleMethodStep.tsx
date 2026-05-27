import { CarFront, Keyboard, ScanLine } from "lucide-react";
import { ActionTile } from "../ui/ActionTile";
import { Card } from "../ui/Card";
import type { Customer } from "../../types/customer";

interface AddVehicleMethodStepProps {
  customer: Customer;
  onSelectVin: () => void;
  onSelectPlate: () => void;
  onSelectManual: () => void;
}

export function AddVehicleMethodStep({ customer, onSelectVin, onSelectPlate, onSelectManual }: AddVehicleMethodStepProps) {
  const customerName = `${customer.first_name} ${customer.last_name}`.trim();

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-4xl p-8">
        <div>
          <h1 className="text-2xl font-black text-[var(--pos-text)]">Add Vehicle</h1>
          <p className="mt-1 text-sm text-[var(--pos-muted)]">Choose how you want to add a vehicle for {customerName}.</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <ActionTile
            title="Scan / Enter VIN"
            description="Decode the VIN and fill vehicle details automatically."
            icon={<ScanLine size={24} />}
            onClick={onSelectVin}
          />
          <ActionTile
            title="License Plate"
            description="Search local records by plate and state."
            icon={<CarFront size={24} />}
            onClick={onSelectPlate}
          />
          <ActionTile
            title="Manual Entry"
            description="Enter year, make, model, and identifier manually."
            icon={<Keyboard size={24} />}
            onClick={onSelectManual}
          />
        </div>
      </Card>
    </div>
  );
}
