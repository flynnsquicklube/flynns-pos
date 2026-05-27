import { AlertTriangle, CarFront, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { formatPlateForDisplay, normalizePlate } from "../../lib/domain/vehicles/plateUtils";
import type { Customer } from "../../types/customer";
import type { Vehicle } from "../../types/vehicle";

interface PlateLookupStepProps {
  plate: string;
  plateState: string;
  validation: string | null;
  searching?: boolean;
  searched?: boolean;
  matchedVehicle?: Vehicle | null;
  matchedCustomer?: Customer | null;
  onPlateChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onUseExistingVehicle?: (mileage: string) => void;
  onContinue: () => void;
  showInlineBack?: boolean;
}

export function PlateLookupStep({ plate, plateState, validation, searching = false, searched = false, matchedVehicle, matchedCustomer, onPlateChange, onStateChange, onBack, onSearch, onUseExistingVehicle, onContinue, showInlineBack = true }: PlateLookupStepProps) {
  const [currentMileage, setCurrentMileage] = useState("");
  const [lowerMileageConfirmed, setLowerMileageConfirmed] = useState(false);
  const normalizedPlate = normalizePlate(plate);
  const hasPlate = Boolean(normalizedPlate);
  const parsedMileage = Number(currentMileage);
  const hasValidMileage = Number.isFinite(parsedMileage) && parsedMileage > 0;
  const lowerThanLastMileage = Boolean(matchedVehicle?.mileage && hasValidMileage && parsedMileage < matchedVehicle.mileage);
  const canUseExistingVehicle = Boolean(onUseExistingVehicle && hasValidMileage && (!lowerThanLastMileage || lowerMileageConfirmed));

  useEffect(() => {
    setCurrentMileage("");
    setLowerMileageConfirmed(false);
  }, [matchedVehicle?.id]);
  return (
    <div className="flex min-h-[540px] items-center justify-center">
      <Card className="w-full max-w-4xl p-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--brand-primary-light)] text-[var(--brand-primary)]">
          <CarFront size={42} />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-950">License Plate Search</h1>
        <p className="mt-2 text-sm text-slate-500">Search local vehicle records by plate and state.</p>
        <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left md:grid-cols-[160px_1fr]">
          <label className="text-sm font-semibold text-slate-700">
            State
            <select className="mt-2 h-14 w-full rounded-md border border-[var(--brand-border)] bg-white px-3 text-lg font-semibold text-slate-900 outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-light)]" value={plateState} onChange={(event) => onStateChange(event.target.value)}>
              <option value="OH">Ohio</option>
              <option value="IN">Indiana</option>
              <option value="KY">Kentucky</option>
              <option value="MI">Michigan</option>
              <option value="PA">Pennsylvania</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            License Plate
            <Input
              className="mt-2 h-14 text-center text-lg font-semibold uppercase"
              placeholder="Enter License Plate"
              value={plate}
              autoFocus
              onChange={(event) => onPlateChange(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch();
              }}
            />
          </label>
        </div>
        {validation ? <p className="mt-3 text-sm font-semibold text-amber-700">{validation}</p> : null}
        {matchedVehicle ? (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">Existing vehicle found</div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{[matchedVehicle.year, matchedVehicle.make, matchedVehicle.model].filter(Boolean).join(" ") || "Saved vehicle"}</h2>
                <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                  <span>Plate: {formatPlateForDisplay(matchedVehicle.plate, matchedVehicle.plate_state)}</span>
                  <span>VIN: {matchedVehicle.vin ?? "Not recorded"}</span>
                  <span>Customer: {matchedCustomer ? `${matchedCustomer.first_name} ${matchedCustomer.last_name}` : "No linked customer"}</span>
                  <span>Last mileage: {matchedVehicle.mileage?.toLocaleString() ?? "Not recorded"}</span>
                  <span>Oil type: {matchedVehicle.oil_type ?? "Not recorded"}</span>
                  <span>Oil filter: {matchedVehicle.oil_filter_sku ?? "Not recorded"}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                label="Current Mileage"
                type="number"
                inputSize="touch"
                value={currentMileage}
                onChange={(event) => {
                  setCurrentMileage(event.target.value);
                  setLowerMileageConfirmed(false);
                }}
                placeholder="Enter current mileage"
                helperText={matchedVehicle.mileage ? `Last recorded: ${matchedVehicle.mileage.toLocaleString()} mi` : "No previous mileage recorded."}
              />
              <Button size="touch" onClick={() => onUseExistingVehicle?.(currentMileage)} disabled={!canUseExistingVehicle}>
                Use Existing Vehicle
              </Button>
            </div>
            {currentMileage.trim() && !hasValidMileage ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-[var(--pos-danger)]">Mileage must be greater than 0.</div>
            ) : null}
            {lowerThanLastMileage ? (
              <label className="mt-3 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={lowerMileageConfirmed}
                  onChange={(event) => setLowerMileageConfirmed(event.target.checked)}
                />
                <span>
                  <span className="flex items-center gap-2 font-black"><AlertTriangle size={16} /> Current mileage is lower than the last recorded mileage.</span>
                  <span className="mt-1 block">Confirm mileage is correct.</span>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
        {searched && !matchedVehicle ? (
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
            <div className="text-lg font-black text-slate-950">No local vehicle found.</div>
            <p className="mt-1 text-sm font-semibold text-amber-800">No local vehicle found for {formatPlateForDisplay(plate, plateState)}. Continue with a new vehicle and the plate/state will be filled into Specs.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={!hasPlate} onClick={onContinue}>Continue with New Vehicle</Button>
              <Button variant="secondary" onClick={onSearch}>Search Again</Button>
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {showInlineBack ? <Button variant="secondary" onClick={onBack}>Back</Button> : null}
          <Button icon={<Search size={16} />} disabled={searching || !hasPlate} onClick={onSearch}>{searching ? "Searching..." : "Search Plate"}</Button>
          {!searched ? <Button variant="secondary" disabled={!hasPlate} onClick={onContinue}>Continue with New Vehicle</Button> : null}
        </div>
      </Card>
    </div>
  );
}
