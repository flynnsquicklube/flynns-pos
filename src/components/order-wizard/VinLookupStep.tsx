import { useState } from "react";
import { Camera, Flame, Search } from "lucide-react";
import { VinCameraScannerModal } from "../scanner/VinCameraScannerModal";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { extractVinFromScannedText } from "../../lib/domain/vehicles/vinUtils";
import type { NormalizedVehicleDecode } from "../../lib/integrations/vinDecoder/vinDecoder.types";

interface VinLookupStepProps {
  vin: string;
  validation: string | null;
  decodeEnabled?: boolean;
  decodeResult?: string | null;
  decodedVehicle?: NormalizedVehicleDecode | null;
  decoding?: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onScannedVin?: (vin: string) => void;
  onDecode: () => void;
  onUseDecoded?: () => void;
  onContinue: () => void;
}

export function VinLookupStep({ vin, validation, decodeEnabled = false, decodeResult, decodedVehicle, decoding = false, onChange, onBack, onSearch, onScannedVin, onDecode, onUseDecoded, onContinue }: VinLookupStepProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const vinLengthWarning = vin.trim().length > 0 && vin.trim().length !== 17 ? "VINs are usually 17 characters. Manual continuation is allowed." : null;
  const handleScannedVin = (scannedVin: string) => {
    const extraction = extractVinFromScannedText(scannedVin);
    if (!extraction.isValid || !extraction.candidate) return;
    onChange(extraction.candidate);
    setScannerOpen(false);
    if (onScannedVin) onScannedVin(extraction.candidate);
  };

  return (
    <div className="flex min-h-[540px] items-center justify-center">
      <Card className="w-full max-w-3xl p-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--brand-primary-light)] text-[var(--brand-primary)]">
          <Flame size={42} />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-950">Awaiting VIN Entry...</h1>
        <p className="mt-2 text-sm text-slate-500">Scan the VIN barcode, type it manually, or decode it with the free NHTSA vPIC service.</p>
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
        <p className="mt-2 text-xs text-slate-500">Press Enter to search local vehicles first. Manual entry always remains available.</p>
        {vinLengthWarning ? <p className="mt-3 text-sm text-amber-700">{vinLengthWarning}</p> : null}
        {validation ? <p className="mt-2 text-sm text-amber-700">{validation}</p> : null}
        {decodeResult ? <p className="mt-2 text-sm text-slate-600">{decodeResult}</p> : null}
        {decodedVehicle ? (
          <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">Decoded by NHTSA</div>
                <div className="mt-1 text-xl font-black text-[var(--pos-text)]">
                  {[decodedVehicle.year, decodedVehicle.make, decodedVehicle.model, decodedVehicle.trim].filter(Boolean).join(" ")}
                </div>
                <div className="mt-2 grid gap-1 text-sm font-semibold text-[var(--pos-muted)] sm:grid-cols-2">
                  <span>Engine: {decodedVehicle.engineModel ?? decodedVehicle.engineDisplacementL ?? "-"}</span>
                  <span>Fuel: {decodedVehicle.fuelType ?? "-"}</span>
                  <span>Drive: {decodedVehicle.driveType ?? "-"}</span>
                  <span>Body: {decodedVehicle.bodyClass ?? "-"}</span>
                  <span>VIN: {decodedVehicle.vin}</span>
                  <span>Source: {decodedVehicle.source} · {new Date(decodedVehicle.decodedAt).toLocaleString()}</span>
                </div>
              </div>
              {onUseDecoded ? <Button onClick={onUseDecoded}>Use Decoded Vehicle</Button> : null}
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button variant="secondary" icon={<Camera size={16} />} onClick={() => setScannerOpen(true)}>Scan VIN</Button>
          <Button variant="secondary" icon={<Search size={16} />} onClick={onSearch}>Search Local</Button>
          {decodeEnabled ? <Button disabled={decoding || vin.trim().length !== 17} onClick={onDecode}>{decoding ? "Decoding..." : "Decode VIN"}</Button> : null}
          <Button variant="secondary" onClick={onContinue}>Continue Manually</Button>
        </div>
      </Card>
      {scannerOpen ? (
        <VinCameraScannerModal
          onClose={() => setScannerOpen(false)}
          onVinScanned={handleScannedVin}
        />
      ) : null}
    </div>
  );
}
