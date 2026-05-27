import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { TouchSelect } from "../ui/TouchSelect";
import { formatMoney } from "../../lib/utils/money";
import { searchEngineOil, searchOilFilters } from "../../lib/db/repositories/inventoryRepo";
import { calculatePackagePricing } from "../../lib/utils/pricing";
import { getPackageWorkflowValidation } from "../../lib/domain/packages/packageValidation";
import { inventoryItemToOilSelectionSuggestion, type OilSelectionSuggestion } from "../../lib/domain/services/oilSelection";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";
import type { VehicleServiceDefaultsResult } from "../../lib/domain/vehicles/vehicleServiceDefaults";
import type { Customer } from "../../types/customer";
import type { InventoryItem } from "../../types/inventory";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import type { VehicleSpecsForm } from "./orderWizardTypes";
import { ServiceOperationPanel } from "./ServiceOperationPanel";
import { PackageSelectionsSummary } from "./PackageSelectionsSummary";

interface PackageWorkflowScreenProps {
  servicePackage: ServicePackage;
  selectedCustomer: Customer | null;
  specs: VehicleSpecsForm;
  actualQuarts: string;
  filterType: PackageFilterType;
  oilTypeOverride: string;
  selectedOilFilter: OilFilterSuggestion | null;
  oilFilterSuggestion: OilFilterSuggestion | null;
  serviceDefaults: VehicleServiceDefaultsResult | null;
  filterChoice: "inventory" | "suggested" | "manual" | "customer_supplied" | "no_filter" | "standard_unmatched" | null;
  selectedOil: OilSelectionSuggestion | null;
  taxRate: number;
  onBack: () => void;
  onActualQuartsChange: (value: string) => void;
  onFilterTypeChange: (value: PackageFilterType) => void;
  onOilTypeOverrideChange: (value: string) => void;
  onUseFilter: (filter: OilFilterSuggestion, choice: "inventory" | "suggested" | "manual") => void;
  onCustomerSuppliedFilter: () => void;
  onNoFilter: () => void;
  onSelectOil: (oil: OilSelectionSuggestion) => void;
  onUsePreviousOilSetup: () => void;
  onSaveVehicleDefaults: () => void;
  onAddPackage: () => void;
}

function filterFromInventory(item: InventoryItem, source: "manual" | "suggested"): OilFilterSuggestion {
  return {
    inventoryItemId: item.id,
    sku: item.sku ?? undefined,
    productId: item.product_id ?? undefined,
    name: item.name,
    brand: item.vendor ?? undefined,
    retailPrice: item.retail_price,
    cost: item.cost,
    quantityOnHand: item.quantity_on_hand,
    source: source === "manual" ? "manual" : "inventory_match",
    confidence: "high",
    message: source === "manual" ? "Manually selected from local inventory." : "Suggested from local inventory."
  };
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

export function PackageWorkflowScreen(props: PackageWorkflowScreenProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [oilQuery, setOilQuery] = useState("");
  const [filterResults, setFilterResults] = useState<InventoryItem[]>([]);
  const [oilResults, setOilResults] = useState<InventoryItem[]>([]);
  const vehicleLabel = [props.specs.year, props.specs.make, props.specs.model].filter(Boolean).join(" ") || "Vehicle";
  const oilFilterPrice = props.filterChoice === "customer_supplied" || props.filterChoice === "no_filter" || props.filterChoice === "standard_unmatched"
    ? 0
    : Math.max(Number(props.selectedOilFilter?.retailPrice) || 0, 0);
  const pricing = useMemo(() => calculatePackagePricing({
    selectedPackage: props.servicePackage,
    actualQuarts: Number(props.actualQuarts) || props.servicePackage.included_quarts,
    filterType: props.filterType,
    oilFilterPrice,
    oilFilterCost: props.selectedOilFilter?.cost,
    oilFilterTaxable: 1,
    addons: [],
    taxRate: props.taxRate
  }), [oilFilterPrice, props.actualQuarts, props.filterType, props.selectedOilFilter?.cost, props.servicePackage, props.taxRate]);
const selectedOilType = props.oilTypeOverride || props.specs.oil_type || props.servicePackage.oil_type || "";
  const missing = getPackageWorkflowValidation({
    servicePackage: props.servicePackage,
    actualQuarts: props.actualQuarts || String(props.servicePackage.included_quarts),
    filterType: props.filterType,
    filterChoice: props.filterChoice,
    selectedOilFilterId: props.selectedOilFilter?.inventoryItemId,
    selectedOilSku: props.selectedOil?.sku,
    oilType: selectedOilType
  });
  const canAddPackage = missing.length === 0;
  const suggestedFilter = props.oilFilterSuggestion?.source !== "none" ? props.oilFilterSuggestion : null;
  const displayedFilter = props.filterChoice === "customer_supplied" || props.filterChoice === "no_filter" || props.filterChoice === "standard_unmatched" ? null : props.selectedOilFilter ?? suggestedFilter;
  const previousService = props.serviceDefaults?.previousService ?? null;
  const previousOilLabel = previousService?.found
    ? [previousService.oilBrand, previousService.oilType, previousService.viscosity && previousService.viscosity !== previousService.oilType ? previousService.viscosity : null].filter(Boolean).join(" · ") || "Oil type not recorded"
    : null;
  const filterOperationComplete = Boolean(
    props.filterChoice === "customer_supplied" ||
      props.filterChoice === "no_filter" ||
      ((props.filterType === "standard" || props.filterType === "cartridge") && props.selectedOilFilter?.inventoryItemId)
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchOilFilters(filterQuery, 12).then(setFilterResults).catch(() => setFilterResults([]));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [filterQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchEngineOil(oilQuery, selectedOilType, 12).then(setOilResults).catch(() => setOilResults([]));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [oilQuery, selectedOilType]);

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4">
          <Button size="sm" variant="ghost" icon={<ArrowLeft size={17} />} onClick={props.onBack}>Back to Packages</Button>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue-2)]">Viewing Package</div>
              <h1 className="mt-1 text-2xl font-black text-[var(--pos-text)]">{props.servicePackage.name}</h1>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">{props.selectedCustomer ? `${props.selectedCustomer.first_name} ${props.selectedCustomer.last_name}` : "Customer"} · {vehicleLabel}</p>
            </div>
            <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-4 py-3 text-sm text-[var(--pos-muted)]">
              Engine: {props.specs.engine || "Not set"} · Mileage: {props.specs.mileage || "Needed"}
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${previousService?.found ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-panel)]"}`}>
          {previousService?.found ? (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue-2)]">Previous Service Found</div>
                <div className="mt-2 grid gap-2 text-sm text-[var(--pos-text)] sm:grid-cols-2">
                  <div><span className="font-black">Last serviced:</span> {formatShortDate(previousService.lastServiceDate)}{previousService.lastServiceMileage ? ` at ${previousService.lastServiceMileage.toLocaleString()} mi` : ""}</div>
                  <div><span className="font-black">Package:</span> {previousService.packageName ?? "Not recorded"}</div>
                  <div><span className="font-black">Oil:</span> {previousOilLabel}</div>
                  <div><span className="font-black">Capacity used:</span> {previousService.actualQuarts ? `${previousService.actualQuarts} qt` : "Not recorded"}</div>
                  <div><span className="font-black">Filter:</span> {previousService.filterSku ?? previousService.filterName ?? props.oilFilterSuggestion?.sku ?? props.oilFilterSuggestion?.name ?? "Not recorded"}</div>
                  <div><span className="font-black">Source:</span> {previousService.sourceLabel} · {previousService.confidence}</div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" onClick={props.onUsePreviousOilSetup}>Use Previous Oil Setup</Button>
                <Button size="sm" variant="secondary" onClick={() => document.getElementById("oil-package-flow")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={props.onSaveVehicleDefaults}>Save as Vehicle Defaults</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-black text-[var(--pos-text)]">No previous oil setup found for this vehicle.</div>
                <div className="mt-1 text-[var(--pos-muted)]">Use manual oil/filter lookup.</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => document.getElementById("oil-package-flow")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Manual Lookup</Button>
            </div>
          )}
        </div>

        <ServiceOperationPanel title="Step 1: Confirm Oil Type" complete={Boolean(selectedOilType || props.selectedOil)}>
          <div id="oil-package-flow" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-muted)]">Selected package</div>
              <div className="mt-1 text-xl font-black text-[var(--pos-text)]">{props.servicePackage.name}</div>
              <div className="mt-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-sm">
                <div className="font-black text-[var(--pos-text)]">Recommended package oil</div>
                <div className="mt-1 font-semibold text-[var(--pos-blue-2)]">
                  {[props.servicePackage.oil_brand, props.servicePackage.oil_type].filter(Boolean).join(" · ") || "Oil change package"}
                </div>
                <div className="mt-1 text-[var(--pos-muted)]">
                  Vehicle suggestion: {props.specs.oil_type || "No saved viscosity/type"}
                </div>
              </div>
            </div>
            <div>
              <Input label="Oil formulation / viscosity" inputSize="touch" value={props.oilTypeOverride} placeholder={props.servicePackage.oil_type ?? props.specs.oil_type ?? "Oil type"} onChange={(event) => props.onOilTypeOverrideChange(event.target.value)} helperText="Confirm the oil used for this service. Previous vehicle oil is a suggestion only." />
              {props.selectedOil ? (
                <div className="mt-3 rounded-xl border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] p-3 text-sm">
                  <div className="font-black text-[var(--pos-text)]">{props.selectedOil.name ?? props.selectedOil.sku ?? "Selected oil"}</div>
                  <div className="mt-1 text-[var(--pos-muted)]">{props.selectedOil.brand ?? props.servicePackage.oil_brand ?? "No brand"} · {(props.selectedOil.viscosity ?? selectedOilType) || "No viscosity"} · Qty {props.selectedOil.quantityOnHand ?? "-"}</div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={18} />
            <Input inputSize="touch" className="pl-11" placeholder="Search engine oil inventory, viscosity, formulation..." value={oilQuery} onChange={(event) => setOilQuery(event.target.value)} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {oilResults.map((item) => (
              <button key={item.id} onClick={() => props.onSelectOil(inventoryItemToOilSelectionSuggestion(item))} className={`rounded-xl border p-4 text-left hover:border-[var(--pos-blue)] ${props.selectedOil?.inventoryItemId === item.id ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-panel)]"}`}>
                <div className="font-black text-[var(--pos-text)]">{item.product_id ?? item.sku ?? "Oil"}</div>
                <div className="mt-1 text-sm font-bold text-[var(--pos-text)]">{item.name}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.vendor ?? "No vendor"} · {item.viscosity ?? "-"} · {item.oil_formulation ?? "-"} · Qty {item.quantity_on_hand}</div>
              </button>
            ))}
          </div>
        </ServiceOperationPanel>

        <ServiceOperationPanel title="Step 2: Confirm Oil Quantity" complete={Boolean(Number(props.actualQuarts) > 0)}>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <Input label="Actual quarts" inputSize="touch" type="number" min="0.1" step="0.1" value={props.actualQuarts} onChange={(event) => props.onActualQuartsChange(event.target.value)} helperText={`Included in package: ${props.servicePackage.included_quarts} QT`} />
            <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 text-sm">
              <div className="font-black text-[var(--pos-text)]">Quantity math</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div><div className="text-[var(--pos-muted)]">Included</div><div className="font-black text-[var(--pos-text)]">{pricing.includedQuarts} QT</div></div>
                <div><div className="text-[var(--pos-muted)]">Actual</div><div className="font-black text-[var(--pos-text)]">{pricing.actualQuarts} QT</div></div>
                <div><div className="text-[var(--pos-muted)]">Extra charge</div><div className="font-black text-[var(--pos-text)]">{formatMoney(pricing.extraQuartTotal)}</div></div>
              </div>
            </div>
          </div>
        </ServiceOperationPanel>

        <ServiceOperationPanel title="Step 3: Confirm Oil Filter" complete={filterOperationComplete}>
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <TouchSelect
              label="Filter type"
              value={props.filterType}
              onChange={(value) => props.onFilterTypeChange(value as PackageFilterType)}
              options={[
                { value: "standard", label: "Standard filter" },
                { value: "cartridge", label: "Cartridge filter" },
                { value: "customer_supplied", label: "Customer supplied filter" },
                { value: "none", label: "No filter" }
              ]}
            />
            <div className="flex flex-wrap content-start gap-2 text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">
              <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1">Saved vehicle default</span>
              <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1">Previous service history</span>
              <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1">Inventory match</span>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase text-[var(--pos-muted)]">Suggested Filter</div>
                <div className="mt-1 text-lg font-black text-[var(--pos-text)]">{displayedFilter?.sku ?? displayedFilter?.productId ?? (props.filterChoice === "customer_supplied" ? "Customer supplied" : props.filterChoice === "no_filter" ? "No filter" : "No saved filter found for this vehicle.")}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{displayedFilter?.name ?? displayedFilter?.message ?? "Search local inventory or choose customer supplied/no filter."}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{displayedFilter?.brand ?? "No vendor"} · Source {displayedFilter?.source ?? props.filterChoice ?? "none"} · {displayedFilter?.confidence ?? "none"}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-[var(--pos-text)]">{displayedFilter?.retailPrice !== undefined ? formatMoney(displayedFilter.retailPrice) : "$0.00"}</div>
                <div className="text-sm text-[var(--pos-muted)]">{displayedFilter?.quantityOnHand !== undefined ? `${displayedFilter.quantityOnHand} on hand` : "Retail line required unless supplied/no filter"}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {displayedFilter?.source !== "none" && displayedFilter ? <Button size="sm" onClick={() => props.onUseFilter(displayedFilter, "inventory")}>Use This Filter</Button> : null}
              <Button size="sm" variant="secondary" onClick={props.onCustomerSuppliedFilter}>Customer Supplied</Button>
              <Button size="sm" variant="ghost" onClick={props.onNoFilter}>No Filter</Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={18} />
            <Input inputSize="touch" className="pl-11" placeholder="Search oil filter by product ID, SKU, name, brand..." value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {filterResults.map((item) => (
              <button key={item.id} onClick={() => props.onUseFilter(filterFromInventory(item, "manual"), "manual")} className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 text-left hover:border-[var(--pos-blue)]">
                <div className="font-black text-[var(--pos-text)]">{item.product_id ?? item.sku ?? "No product ID"}</div>
                <div className="mt-1 text-sm font-bold text-[var(--pos-text)]">{item.name}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.vendor ?? "No vendor"} · Qty {item.quantity_on_hand} · {formatMoney(item.retail_price)}</div>
              </button>
            ))}
          </div>
        </ServiceOperationPanel>

        <ServiceOperationPanel title="Step 4: Review / Add to Ticket" complete={canAddPackage}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4">
              <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-muted)]">Package</div>
              <div className="mt-1 font-black text-[var(--pos-text)]">{props.servicePackage.name}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{[props.servicePackage.oil_brand, props.servicePackage.oil_type].filter(Boolean).join(" · ") || "Oil change package"}</div>
            </div>
            <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4">
              <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-muted)]">Oil / quarts</div>
              <div className="mt-1 font-black text-[var(--pos-text)]">{props.selectedOil?.name ?? selectedOilType ?? "Oil not confirmed"}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{props.actualQuarts || props.servicePackage.included_quarts} QT · Extra {pricing.extraQuarts} QT</div>
            </div>
            <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4">
              <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-muted)]">Filter</div>
              <div className="mt-1 font-black text-[var(--pos-text)]">{props.filterChoice === "customer_supplied" ? "Customer supplied" : props.filterChoice === "no_filter" ? "No filter" : props.selectedOilFilter?.sku ?? props.selectedOilFilter?.productId ?? props.selectedOilFilter?.name ?? "Filter not selected"}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">{props.selectedOilFilter?.name ?? props.filterChoice ?? "Choose filter option"}</div>
            </div>
            <div className="rounded-xl border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] p-4">
              <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue-2)]">Estimated total</div>
              <div className="mt-1 text-3xl font-black text-[var(--pos-blue-2)]">{formatMoney(pricing.total)}</div>
              <div className="mt-1 text-sm text-[var(--pos-muted)]">Package + filter + extra quarts + tax estimate</div>
            </div>
          </div>
        </ServiceOperationPanel>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3">
          <div className="text-sm font-semibold text-[var(--pos-muted)]">
            {canAddPackage ? "Package is ready for the invoice. Next action: Send to Bay." : missing[0] ?? "Complete required operations."}
          </div>
          <Button size="touch" disabled={!canAddPackage} onClick={props.onAddPackage}>Add Package to Invoice</Button>
        </div>
      </div>

      <PackageSelectionsSummary servicePackage={props.servicePackage} pricing={pricing} selectedOilFilter={props.selectedOilFilter} filterChoice={props.filterChoice} selectedOil={props.selectedOil} actualQuarts={props.actualQuarts || String(props.servicePackage.included_quarts)} missing={missing} />
    </div>
  );
}
