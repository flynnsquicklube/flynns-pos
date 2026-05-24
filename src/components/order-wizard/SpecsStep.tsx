import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import type { VehicleSpecsForm } from "./orderWizardTypes";

interface SpecsStepProps {
  specs: VehicleSpecsForm;
  validation: string | null;
  onChange: (specs: VehicleSpecsForm) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function SpecsStep({ specs, validation, onChange, onPrevious, onNext }: SpecsStepProps) {
  const update = (key: keyof VehicleSpecsForm, value: string) => onChange({ ...specs, [key]: value });
  const canContinue = Boolean(specs.year && specs.make.trim() && specs.model.trim() && specs.mileage);
  const vehicleFields: Array<{ key: keyof VehicleSpecsForm; label: string; required?: boolean; type?: string; placeholder?: string }> = [
    { key: "year", label: "Year", required: true, type: "number" },
    { key: "make", label: "Make", required: true },
    { key: "model", label: "Model", required: true },
    { key: "engine", label: "Engine", placeholder: "Optional" }
  ];
  const identificationFields: Array<{ key: keyof VehicleSpecsForm; label: string; required?: boolean; type?: string; placeholder?: string }> = [
    { key: "vin", label: "VIN" },
    { key: "plate", label: "Plate" },
    { key: "plate_state", label: "Plate State" }
  ];
  const serviceFields: Array<{ key: keyof VehicleSpecsForm; label: string; required?: boolean; type?: string; placeholder?: string }> = [
    { key: "mileage", label: "Mileage", required: true, type: "number" },
    { key: "oil_type", label: "Oil Type" },
    { key: "notes", label: "Notes", placeholder: "Optional" }
  ];

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-4xl p-8">
        <h1 className="text-2xl font-bold text-slate-950">Vehicle Specs</h1>
        <p className="mt-1 text-sm text-slate-500">Confirm or enter the vehicle information for this service order.</p>
        {validation ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{validation}</div> : null}
        {(specs.vin || specs.plate) ? (
          <div className="mt-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-primary-light)] p-4 text-sm text-[var(--brand-primary-dark)]">
            Vehicle lookup context: {specs.vin ? `VIN ${specs.vin}` : ""} {specs.plate ? `Plate ${specs.plate} ${specs.plate_state}` : ""}
          </div>
        ) : null}
        <div className="mt-6 grid gap-5">
          {[
            ["Vehicle Details", vehicleFields],
            ["Identification", identificationFields],
            ["Service Defaults", serviceFields]
          ].map(([title, fields]) => (
            <div key={title as string} className="rounded-xl border border-[var(--brand-border)] bg-slate-50 p-4">
              <h2 className="text-base font-bold text-slate-950">{title as string}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(fields as typeof vehicleFields).map((field) => (
                  <label key={field.key} className="text-sm font-semibold text-slate-700">
                    {field.label}{field.required ? <span className="text-red-600"> *</span> : null}
                    <Input
                      className="mt-2"
                      inputSize="touch"
                      placeholder={field.placeholder ?? field.label}
                      type={field.type}
                      value={specs[field.key]}
                      onChange={(event) => update(field.key, field.key === "plate" || field.key === "plate_state" ? event.target.value.toUpperCase() : event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-between">
          <Button variant="secondary" onClick={onPrevious}>Previous</Button>
          <Button disabled={!canContinue} onClick={onNext}>Next</Button>
        </div>
      </Card>
    </div>
  );
}
