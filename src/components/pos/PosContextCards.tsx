import { CarFront, UserRound } from "lucide-react";
import { Badge } from "../ui/Badge";
import { PosCard } from "./PosCard";

interface CustomerContext {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  imported?: boolean;
}

interface VehicleContext {
  label?: string | null;
  vin?: string | null;
  plate?: string | null;
  mileage?: number | null;
  oilType?: string | null;
}

export function PosCustomerCard({ customer }: { customer: CustomerContext }) {
  const initials = (customer.name ?? "Customer").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <PosCard className="min-h-[144px]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pos-blue)] text-sm font-black text-white">{initials || <UserRound size={20} />}</div>
        <div className="min-w-0">
          <div className="font-black text-[var(--pos-text)]">{customer.name ?? "No customer selected"}</div>
          <div className="mt-1 text-sm text-[var(--pos-muted)]">{customer.phone ?? "No phone"}</div>
          <div className="truncate text-sm text-[var(--pos-muted)]">{customer.email ?? "No email"}</div>
          {customer.imported ? <Badge tone="blue" className="mt-2">Imported</Badge> : null}
        </div>
      </div>
    </PosCard>
  );
}

export function PosVehicleCard({ vehicle }: { vehicle: VehicleContext }) {
  return (
    <PosCard className="min-h-[144px]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pos-panel-2)] text-[var(--pos-blue-2)]"><CarFront size={24} /></div>
        <div className="min-w-0">
          <div className="font-black text-[var(--pos-text)]">{vehicle.label ?? "No vehicle selected"}</div>
          <div className="mt-1 text-sm text-[var(--pos-muted)]">{vehicle.plate ?? vehicle.vin ?? "No plate/VIN"}</div>
          <div className="text-sm text-[var(--pos-muted)]">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "Mileage needed"}{vehicle.oilType ? ` · ${vehicle.oilType}` : ""}</div>
        </div>
      </div>
    </PosCard>
  );
}
