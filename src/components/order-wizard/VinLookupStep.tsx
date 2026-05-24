import { Camera, Flame, Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

interface VinLookupStepProps {
  vin: string;
  validation: string | null;
  onChange: (value: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onContinue: () => void;
}

export function VinLookupStep({ vin, validation, onChange, onBack, onSearch, onContinue }: VinLookupStepProps) {
  const vinLengthWarning = vin.trim().length > 0 && vin.trim().length !== 17 ? "VINs are usually 17 characters. Manual continuation is allowed." : null;

  return (
    <div className="flex min-h-[540px] items-center justify-center">
      <Card className="w-full max-w-3xl p-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--brand-primary-light)] text-[var(--brand-primary)]">
          <Flame size={42} />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-950">Awaiting VIN Entry...</h1>
        <p className="mt-2 text-sm text-slate-500">Scan the VIN barcode or type it manually.</p>
        <label className="mx-auto mt-8 block max-w-xl text-left text-sm font-semibold text-slate-700">
          VIN
          <Input
            className="mt-2 h-14 text-center text-lg font-semibold"
            placeholder="Enter/Scan VIN Now"
            value={vin}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">Press Enter to continue.</p>
        {vinLengthWarning ? <p className="mt-3 text-sm text-amber-700">{vinLengthWarning}</p> : null}
        {validation ? <p className="mt-2 text-sm text-amber-700">{validation}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button variant="secondary" disabled icon={<Camera size={16} />}>Camera VIN Scanner</Button>
          <Button icon={<Search size={16} />} onClick={onSearch}>Search VIN</Button>
          <Button variant="secondary" onClick={onContinue}>Continue Manually</Button>
        </div>
      </Card>
    </div>
  );
}
