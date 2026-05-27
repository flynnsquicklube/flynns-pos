import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { validateVehicleIdentifier } from "../../lib/domain/startTicket/startTicketValidation";
import { getOptionDetails, listMakesForYear, listModelsForYearMake, listOptionsForYearMakeModel, listYears } from "../../lib/integrations/vehicleCatalog/vehicleCatalog.service";
import type { Customer } from "../../types/customer";
import type { Vehicle } from "../../types/vehicle";
import type { VehicleCatalogMake, VehicleCatalogModel, VehicleCatalogOption, VehicleCatalogYear } from "../../lib/integrations/vehicleCatalog/vehicleCatalog.types";
import type { VehicleSpecsForm } from "./orderWizardTypes";

interface SpecsStepProps {
  specs: VehicleSpecsForm;
  validation: string | null;
  decodedBy?: string | null;
  matchedVehicle?: Vehicle | null;
  matchedCustomer?: Customer | null;
  nextLabel?: string;
  showPreviousButton?: boolean;
  onChange: (specs: VehicleSpecsForm) => void;
  onPrevious: () => void;
  onNext: () => void;
  onLookupVehicleInfo?: () => void;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  children: ReactNode;
}

function SelectField({ label, value, onChange, disabled, required, helperText, children }: SelectFieldProps) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}{required ? <span className="text-red-600"> *</span> : null}
      <select
        className="mt-2 h-12 w-full rounded-xl border border-[var(--brand-border)] bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      {helperText ? <div className="mt-1 text-xs font-medium text-slate-500">{helperText}</div> : null}
    </label>
  );
}

function optionLabel(option: VehicleCatalogOption) {
  return [
    option.trim,
    option.engine,
    option.transmission,
    option.drive,
    option.fuelType
  ].filter(Boolean).join(" · ") || `${option.year} ${option.make} ${option.model}`;
}

function normalizeKey(value: string | number | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

export function SpecsStep({ specs, validation, decodedBy, matchedVehicle, matchedCustomer, nextLabel = "Next", showPreviousButton = true, onChange, onPrevious, onNext, onLookupVehicleInfo }: SpecsStepProps) {
  const [years, setYears] = useState<VehicleCatalogYear[]>([]);
  const [makes, setMakes] = useState<VehicleCatalogMake[]>([]);
  const [models, setModels] = useState<VehicleCatalogModel[]>([]);
  const [options, setOptions] = useState<VehicleCatalogOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState<"years" | "makes" | "models" | "options" | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const update = (key: keyof VehicleSpecsForm, value: string) => onChange({ ...specs, [key]: value });
  const identifierValidation = validateVehicleIdentifier(specs);
  const canAttemptContinue = Boolean(specs.year && specs.make.trim() && specs.model.trim() && specs.mileage);
  const showIdentifierError = Boolean(validation && !identifierValidation.valid && validation === (identifierValidation.reason ?? identifierValidation.message));
  const topValidation = showIdentifierError ? null : validation;
  const selectedYear = Number(specs.year);
  const hasCatalogShape = Boolean(specs.year && specs.make && specs.model);
  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedOptionId) ?? null,
    [options, selectedOptionId]
  );
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

  useEffect(() => {
    let active = true;
    setLoadingCatalog("years");
    listYears()
      .then((rows) => {
        if (active) setYears(rows);
      })
      .catch(() => {
        if (active) {
          setCatalogMessage("Vehicle catalog is unavailable. Manual override remains available.");
          setManualOverride(true);
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!Number.isFinite(selectedYear) || !selectedYear) {
      setMakes([]);
      return;
    }
    setLoadingCatalog("makes");
    listMakesForYear(selectedYear)
      .then((rows) => {
        if (active) setMakes(rows);
      })
      .catch(() => {
        if (active) {
          setMakes([]);
          setCatalogMessage("Could not load makes for that year. Use manual override if needed.");
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(null);
      });
    return () => {
      active = false;
    };
  }, [selectedYear]);

  useEffect(() => {
    let active = true;
    if (!Number.isFinite(selectedYear) || !selectedYear || !specs.make.trim()) {
      setModels([]);
      return;
    }
    setLoadingCatalog("models");
    listModelsForYearMake(selectedYear, specs.make)
      .then((rows) => {
        if (active) setModels(rows);
      })
      .catch(() => {
        if (active) {
          setModels([]);
          setCatalogMessage("Could not load models for that make. Use manual override if needed.");
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(null);
      });
    return () => {
      active = false;
    };
  }, [selectedYear, specs.make]);

  useEffect(() => {
    let active = true;
    if (!Number.isFinite(selectedYear) || !selectedYear || !specs.make.trim() || !specs.model.trim()) {
      setOptions([]);
      setSelectedOptionId("");
      return;
    }
    setLoadingCatalog("options");
    listOptionsForYearMakeModel(selectedYear, specs.make, specs.model)
      .then((rows) => {
        if (!active) return;
        setOptions(rows);
        const decodedMatch = rows.find((option) => {
          const trimMatch = specs.trim && normalizeKey(option.trim).includes(normalizeKey(specs.trim));
          const engineMatch = specs.engine && normalizeKey(option.engine).includes(normalizeKey(specs.engine));
          return trimMatch || engineMatch;
        });
        setSelectedOptionId(decodedMatch?.id ?? "");
      })
      .catch(() => {
        if (active) {
          setOptions([]);
          setCatalogMessage("Trim and engine options are unavailable. You can still enter details manually.");
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(null);
      });
    return () => {
      active = false;
    };
  }, [selectedYear, specs.make, specs.model, specs.trim, specs.engine]);

  const updateYear = (year: string) => {
    onChange({ ...specs, year, make: "", model: "", trim: "", engine: "", drive_type: "", fuel_type: "", transmission_style: "" });
    setSelectedOptionId("");
  };

  const updateMake = (make: string) => {
    onChange({ ...specs, make, model: "", trim: "", engine: "", drive_type: "", fuel_type: "", transmission_style: "" });
    setSelectedOptionId("");
  };

  const updateModel = (model: string) => {
    onChange({ ...specs, model, trim: "", engine: "", drive_type: "", fuel_type: "", transmission_style: "" });
    setSelectedOptionId("");
  };

  const applyOption = async (optionId: string) => {
    setSelectedOptionId(optionId);
    const found = options.find((option) => option.id === optionId) ?? null;
    if (!found) return;
    let detail = found;
    try {
      const hydrated = await getOptionDetails(optionId);
      if (hydrated) detail = hydrated;
    } catch {
      // EPA option detail is a nice-to-have; the selected menu label is still useful.
    }
    onChange({
      ...specs,
      trim: detail.trim ?? found.trim ?? specs.trim,
      engine: detail.engine ?? found.engine ?? specs.engine,
      drive_type: detail.drive ?? found.drive ?? specs.drive_type,
      fuel_type: detail.fuelType ?? found.fuelType ?? specs.fuel_type,
      transmission_style: detail.transmission ?? found.transmission ?? specs.transmission_style
    });
  };

  const identificationFieldError = (key: keyof VehicleSpecsForm) => {
    if (!showIdentifierError) return undefined;
    if (key === "vin" && identifierValidation.missingFields?.includes("vin")) {
      return specs.vin.trim() ? "Invalid VIN" : "VIN or plate required";
    }
    if (key === "plate" && identifierValidation.missingFields?.includes("plate")) return "VIN or plate required";
    if (key === "plate_state" && identifierValidation.missingFields?.includes("plate_state")) return "Plate state required";
    return undefined;
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-4xl p-8">
        <h1 className="text-2xl font-bold text-slate-950">Vehicle Specs</h1>
        <p className="mt-1 text-sm text-slate-500">Confirm or enter the vehicle information for this service order.</p>
        {topValidation ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{topValidation}</div> : null}
        {decodedBy ? (
          <div className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-[var(--pos-blue)]">
            Decoded by {decodedBy}
          </div>
        ) : null}
        {(specs.vin || specs.plate) ? (
          <div className="mt-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-primary-light)] p-4 text-sm text-[var(--brand-primary-dark)]">
            Vehicle lookup context: {specs.vin ? `VIN ${specs.vin}` : ""} {specs.plate ? `Plate ${specs.plate} ${specs.plate_state}` : ""}
          </div>
        ) : null}
        {matchedVehicle ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">Existing vehicle match</div>
                <div className="mt-1 text-lg font-black text-slate-950">
                  {[matchedVehicle.year, matchedVehicle.make, matchedVehicle.model].filter(Boolean).join(" ") || "Saved vehicle"}
                </div>
                <div className="mt-2 grid gap-1 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                  <span>Customer: {matchedCustomer ? `${matchedCustomer.first_name} ${matchedCustomer.last_name}` : "No linked customer"}</span>
                  <span>Last mileage: {matchedVehicle.mileage?.toLocaleString() ?? "Not recorded"}</span>
                  <span>VIN: {matchedVehicle.vin ?? "Not recorded"}</span>
                  <span>Plate: {[matchedVehicle.plate, matchedVehicle.plate_state].filter(Boolean).join(" ") || "Not recorded"}</span>
                  <span>Oil type: {matchedVehicle.oil_type ?? "Not recorded"}</span>
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 shadow-sm">Update mileage below</div>
            </div>
          </div>
        ) : null}
        {onLookupVehicleInfo && (specs.vin || specs.year || specs.make || specs.model) ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--brand-border)] bg-white p-4">
            <div>
              <div className="font-bold text-slate-950">Need oil capacity or filter info?</div>
              <div className="text-sm text-slate-500">Use local service history first, then optional verified search links.</div>
            </div>
            <Button variant="secondary" onClick={onLookupVehicleInfo}>Lookup Vehicle Info</Button>
          </div>
        ) : null}
        <div className="mt-6 grid gap-5">
          <div className="rounded-xl border border-[var(--brand-border)] bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Vehicle Details</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Choose real catalog values when available. Manual override keeps the shop moving offline.</p>
              </div>
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase transition ${manualOverride ? "border-blue-200 bg-blue-50 text-[var(--pos-blue)]" : "border-[var(--brand-border)] bg-white text-slate-600 hover:border-blue-200"}`}
                onClick={() => setManualOverride((current) => !current)}
              >
                Manual override
              </button>
            </div>
            {catalogMessage ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{catalogMessage}</div> : null}
            {!manualOverride ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SelectField label="Year" value={specs.year} onChange={updateYear} required helperText={loadingCatalog === "years" ? "Loading years..." : undefined}>
                  <option value="">Select year</option>
                  {years.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}
                </SelectField>
                <SelectField label="Make" value={specs.make} onChange={updateMake} disabled={!specs.year || loadingCatalog === "makes"} required helperText={!specs.year ? "Select year first" : loadingCatalog === "makes" ? "Loading makes..." : undefined}>
                  <option value="">{loadingCatalog === "makes" ? "Loading makes..." : "Select make"}</option>
                  {makes.map((item) => <option key={item.makeName} value={item.makeName}>{item.makeName}</option>)}
                </SelectField>
                <SelectField label="Model" value={specs.model} onChange={updateModel} disabled={!specs.year || !specs.make || loadingCatalog === "models"} required helperText={!specs.make ? "Select make first" : loadingCatalog === "models" ? "Loading models..." : undefined}>
                  <option value="">{loadingCatalog === "models" ? "Loading models..." : "Select model"}</option>
                  {models.map((item) => <option key={item.modelName} value={item.modelName}>{item.modelName}</option>)}
                </SelectField>
                <SelectField label="Trim / Option" value={selectedOptionId} onChange={applyOption} disabled={!hasCatalogShape || loadingCatalog === "options"} helperText={loadingCatalog === "options" ? "Loading trim and engine options..." : options.length ? "Selecting an option fills engine details." : "No catalog option selected."}>
                  <option value="">{options.length ? "Select trim / engine option" : "No options found"}</option>
                  {options.map((item) => <option key={item.id} value={item.id}>{optionLabel(item)}</option>)}
                </SelectField>
                <Input inputSize="touch" label="Trim / Submodel" value={specs.trim} onChange={(event) => update("trim", event.target.value)} placeholder="Optional" helperText={selectedOption ? `Source: ${selectedOption.source}` : undefined} />
                <Input inputSize="touch" label="Engine" value={specs.engine} onChange={(event) => update("engine", event.target.value)} placeholder="Optional" />
                <Input inputSize="touch" label="Drive" value={specs.drive_type} onChange={(event) => update("drive_type", event.target.value)} placeholder="Optional" />
                <Input inputSize="touch" label="Fuel Type" value={specs.fuel_type} onChange={(event) => update("fuel_type", event.target.value)} placeholder="Optional" />
                <Input inputSize="touch" label="Transmission" value={specs.transmission_style} onChange={(event) => update("transmission_style", event.target.value)} placeholder="Optional" />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  { key: "year", label: "Year", required: true, type: "number" },
                  { key: "make", label: "Make", required: true },
                  { key: "model", label: "Model", required: true },
                  { key: "trim", label: "Trim / Submodel", placeholder: "Optional" },
                  { key: "engine", label: "Engine", placeholder: "Optional" },
                  { key: "drive_type", label: "Drive", placeholder: "Optional" },
                  { key: "fuel_type", label: "Fuel Type", placeholder: "Optional" },
                  { key: "transmission_style", label: "Transmission", placeholder: "Optional" }
                ].map((field) => (
                  <Input
                    key={field.key}
                    inputSize="touch"
                    label={field.label}
                    required={field.required}
                    placeholder={field.placeholder ?? field.label}
                    type={field.type}
                    value={specs[field.key as keyof VehicleSpecsForm]}
                    onChange={(event) => update(field.key as keyof VehicleSpecsForm, event.target.value)}
                  />
                ))}
              </div>
            )}
          </div>
          {[
            ["Identification", identificationFields],
            ["Service Defaults", serviceFields]
          ].map(([title, fields]) => (
            <div key={title as string} className="rounded-xl border border-[var(--brand-border)] bg-slate-50 p-4">
              <h2 className="text-base font-bold text-slate-950">{title as string}</h2>
              {title === "Identification" && showIdentifierError ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {identifierValidation.reason ?? "Enter either a VIN or license plate before continuing."}
                </div>
              ) : null}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(fields as typeof identificationFields).map((field) => (
                  <Input
                    key={field.key}
                    inputSize="touch"
                    label={field.label}
                    required={field.required}
                    placeholder={field.key === "mileage" ? "Enter current mileage" : field.placeholder ?? field.label}
                    type={field.type}
                    value={specs[field.key]}
                    onChange={(event) => update(field.key, field.key === "plate" || field.key === "plate_state" ? event.target.value.toUpperCase() : event.target.value)}
                    helperText={field.key === "mileage" && matchedVehicle?.mileage ? `Last recorded: ${matchedVehicle.mileage.toLocaleString()} mi` : undefined}
                    errorText={title === "Identification" ? identificationFieldError(field.key) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-between">
          {showPreviousButton ? <Button variant="secondary" onClick={onPrevious}>Previous</Button> : <span />}
          <Button disabled={!canAttemptContinue} onClick={onNext}>{nextLabel}</Button>
        </div>
      </Card>
    </div>
  );
}
