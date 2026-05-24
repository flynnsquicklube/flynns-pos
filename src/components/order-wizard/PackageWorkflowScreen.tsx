import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { formatMoney } from "../../lib/utils/money";
import { searchEngineOil, searchOilFilters } from "../../lib/db/repositories/inventoryRepo";
import { calculatePackagePricing } from "../../lib/utils/pricing";
import { getPackageWorkflowValidation } from "../../lib/domain/packages/packageValidation";
import { inventoryItemToOilSelectionSuggestion, type OilSelectionSuggestion } from "../../lib/domain/services/oilSelection";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";
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
  filterChoice: "suggested" | "manual" | "customer_supplied" | "no_filter" | null;
  selectedOil: OilSelectionSuggestion | null;
  taxRate: number;
  onBack: () => void;
  onActualQuartsChange: (value: string) => void;
  onFilterTypeChange: (value: PackageFilterType) => void;
  onOilTypeOverrideChange: (value: string) => void;
  onUseFilter: (filter: OilFilterSuggestion, choice: "suggested" | "manual") => void;
  onCustomerSuppliedFilter: () => void;
  onNoFilter: () => void;
  onSelectOil: (oil: OilSelectionSuggestion) => void;
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

export function PackageWorkflowScreen(props: PackageWorkflowScreenProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [oilQuery, setOilQuery] = useState("");
  const [filterResults, setFilterResults] = useState<InventoryItem[]>([]);
  const [oilResults, setOilResults] = useState<InventoryItem[]>([]);
  const vehicleLabel = [props.specs.year, props.specs.make, props.specs.model].filter(Boolean).join(" ") || "Vehicle";
  const pricing = useMemo(() => calculatePackagePricing({
    selectedPackage: props.servicePackage,
    actualQuarts: Number(props.actualQuarts) || props.servicePackage.included_quarts,
    filterType: props.filterType,
    addons: [],
    taxRate: props.taxRate
  }), [props.actualQuarts, props.filterType, props.servicePackage, props.taxRate]);
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
  const displayedFilter = props.filterChoice === "customer_supplied" || props.filterChoice === "no_filter" ? null : props.selectedOilFilter ?? props.oilFilterSuggestion;

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
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-5">
          <Button variant="ghost" icon={<ArrowLeft size={17} />} onClick={props.onBack}>Back to Packages</Button>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
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

        <ServiceOperationPanel title="Engine Oil Filter Remove & Replace" complete={Boolean(props.filterChoice)}>
          <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">
            <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1">Selected</span>
            <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1">Previously Used On Vehicle</span>
            <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1 opacity-60">Verified by Part Catalog Coming Soon</span>
            <span className="rounded-full bg-[var(--pos-panel-2)] px-3 py-1 opacity-60">All Catalog Parts Coming Soon</span>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase text-[var(--pos-muted)]">Suggested Filter</div>
                <div className="mt-1 text-lg font-black text-[var(--pos-text)]">{displayedFilter?.sku ?? displayedFilter?.productId ?? (props.filterChoice === "customer_supplied" ? "Customer supplied" : props.filterChoice === "no_filter" ? "No filter" : "No saved filter found")}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{displayedFilter?.name ?? displayedFilter?.message ?? "Search local inventory below."}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{displayedFilter?.brand ?? "No vendor"} · Source {displayedFilter?.source ?? props.filterChoice ?? "none"} · {displayedFilter?.confidence ?? "none"}</div>
              </div>
              <div className="text-right">
                <div className="font-black text-[var(--pos-text)]">{displayedFilter?.retailPrice !== undefined ? formatMoney(displayedFilter.retailPrice) : "Included"}</div>
                <div className="text-sm text-[var(--pos-muted)]">{displayedFilter?.quantityOnHand !== undefined ? `${displayedFilter.quantityOnHand} on hand` : ""}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {displayedFilter?.source !== "none" && displayedFilter ? <Button size="sm" onClick={() => props.onUseFilter(displayedFilter, displayedFilter.source === "manual" ? "manual" : "suggested")}>Use This Filter</Button> : null}
              <Button size="sm" variant="secondary" onClick={props.onCustomerSuppliedFilter}>Customer Supplied</Button>
              <Button size="sm" variant="ghost" onClick={props.onNoFilter}>No Filter</Button>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={18} />
            <Input inputSize="touch" className="pl-11" placeholder="Product ID / Type / Note" value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} />
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

        <ServiceOperationPanel title="Engine Oil Drain & Refill" complete={Boolean(selectedOilType || props.selectedOil)}>
          <div className="grid gap-4 md:grid-cols-[180px_minmax(220px,1fr)]">
            <Input label="Engine Oil System Capacity" inputSize="touch" type="number" min="0.1" step="0.1" value={props.actualQuarts} onChange={(event) => props.onActualQuartsChange(event.target.value)} helperText={`Included: ${props.servicePackage.included_quarts} QT`} />
            <Input label="Oil formulation / viscosity" inputSize="touch" value={props.oilTypeOverride} placeholder={props.servicePackage.oil_type ?? "Oil type"} onChange={(event) => props.onOilTypeOverrideChange(event.target.value)} helperText="Suggested from vehicle, last service, or package default." />
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={18} />
            <Input inputSize="touch" className="pl-11" placeholder="Search oil inventory, viscosity, formulation..." value={oilQuery} onChange={(event) => setOilQuery(event.target.value)} />
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

        <div className="flex justify-end">
          <Button size="touch" disabled={!canAddPackage} onClick={props.onAddPackage}>Add Package</Button>
        </div>
      </div>

      <PackageSelectionsSummary servicePackage={props.servicePackage} pricing={pricing} selectedOilFilter={props.selectedOilFilter} filterChoice={props.filterChoice} selectedOil={props.selectedOil} actualQuarts={props.actualQuarts || String(props.servicePackage.included_quarts)} missing={missing} />
    </div>
  );
}
