import { CarFront, Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

interface PlateLookupStepProps {
  plate: string;
  plateState: string;
  validation: string | null;
  onPlateChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onContinue: () => void;
}

export function PlateLookupStep({ plate, plateState, validation, onPlateChange, onStateChange, onBack, onSearch, onContinue }: PlateLookupStepProps) {
  return (
    <div className="flex min-h-[540px] items-center justify-center">
      <Card className="w-full max-w-3xl p-10 text-center">
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
        {validation ? <p className="mt-3 text-sm text-amber-700">{validation}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button icon={<Search size={16} />} onClick={onSearch}>Search / Continue</Button>
          <Button variant="secondary" onClick={onContinue}>Continue Manually</Button>
        </div>
      </Card>
    </div>
  );
}
