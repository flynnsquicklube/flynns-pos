import { Check, Minus, PackagePlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { formatMoney } from "../../lib/utils/money";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { Customer } from "../../types/customer";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import type { TicketLineInput } from "../../types/ticket";
import type { PackagePricingBreakdown } from "../../lib/utils/pricing";
import type { OilFilterSuggestion } from "../../lib/domain/services/oilFilterSuggestion";
import type { CustomLineForm, VehicleSpecsForm } from "./orderWizardTypes";

interface ServicingStepProps {
  packages: ServicePackage[];
  catalogItems: ServiceCatalogItem[];
  selectedPackage: ServicePackage | null;
  selectedCustomer: Customer | null;
  specs: VehicleSpecsForm;
  actualQuarts: string;
  filterType: PackageFilterType;
  oilTypeOverride: string;
  oilFilterSuggestion: OilFilterSuggestion | null;
  selectedOilFilter: OilFilterSuggestion | null;
  filterChoice: "suggested" | "manual" | "customer_supplied" | "no_filter" | null;
  quartsSuggestionSource: "vehicle_default" | "last_service" | "package_default" | null;
  serviceDefaultsMessage: string | null;
  lines: TicketLineInput[];
  customLine: CustomLineForm;
  customerConcern: string;
  technicianNotes: string;
  internalNotes: string;
  pricing: PackagePricingBreakdown;
  validation: string | null;
  onSelectPackage: (servicePackage: ServicePackage) => void;
  onActualQuartsChange: (actualQuarts: string) => void;
  onFilterTypeChange: (filterType: PackageFilterType) => void;
  onOilTypeOverrideChange: (oilType: string) => void;
  onUseSuggestedFilter: () => void;
  onOpenOilFilterSearch: () => void;
  onCustomerSuppliedFilter: () => void;
  onNoFilter: () => void;
  onAddCatalogItem: (item: ServiceCatalogItem) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onPriceChange: (index: number, price: number) => void;
  onRemoveLine: (index: number) => void;
  onCustomLineChange: (line: CustomLineForm) => void;
  onAddCustomLine: () => void;
  onNotesChange: (notes: { customerConcern: string; technicianNotes: string; internalNotes: string }) => void;
  onPrevious: () => void;
  onNext: () => void;
  onStartService: () => void;
}

const filterOptions: { value: PackageFilterType; label: string }[] = [
  { value: "standard", label: "Standard filter" },
  { value: "cartridge", label: "Cartridge filter" },
  { value: "customer_supplied", label: "Customer supplied filter" },
  { value: "none", label: "No filter" }
];

const categoryTabs = ["Oil Change", "Filters", "Wipers", "Fluids", "Fees", "Custom"] as const;
type CategoryTab = (typeof categoryTabs)[number];

const featuredCategories: Record<Exclude<CategoryTab, "Oil Change" | "Custom">, string[]> = {
  Filters: ["filters", "filter"],
  Wipers: ["wipers", "wiper"],
  Fluids: ["fluids", "fluid"],
  Fees: ["fees", "fee", "discounts", "discount"]
};

function formatQuarts(value: number | string | null | undefined) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "0 qt";
  return `${Number.isInteger(numberValue) ? numberValue : Number(numberValue.toFixed(2))} qt`;
}

function packageSubhead(servicePackage: ServicePackage) {
  return [servicePackage.oil_brand, servicePackage.oil_type].filter(Boolean).join(" · ").toUpperCase();
}

function lineTotal(line: TicketLineInput) {
  return line.quantity * line.unit_price;
}

function isLockedPackageLine(line: TicketLineInput) {
  return line.item_type === "package" || line.name === "Extra Oil Quarts" || line.name === "Cartridge Filter Fee";
}

function getAddOnIndex(lines: TicketLineInput[], item: ServiceCatalogItem) {
  return lines.findIndex((line) => line.service_id === item.id);
}

function visibleItemsForTab(items: ServiceCatalogItem[], tab: CategoryTab) {
  if (tab === "Oil Change" || tab === "Custom") return [];
  const matchers = featuredCategories[tab].map((matcher) => matcher.toLowerCase());
  return items.filter((item) => matchers.some((matcher) => item.category.toLowerCase().includes(matcher) || item.name.toLowerCase().includes(matcher)));
}

function otherCatalogGroups(items: ServiceCatalogItem[]) {
  return items.reduce<Record<string, ServiceCatalogItem[]>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});
}

export function ServicingStep(props: ServicingStepProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("Oil Change");
  const selectedLineCount = props.lines.length;
  const actualQuartsNumber = Number(props.actualQuarts);
  const hasInvalidQuarts = Boolean(props.selectedPackage) && (!Number.isFinite(actualQuartsNumber) || actualQuartsNumber <= 0);
  const canContinue = selectedLineCount > 0 && !hasInvalidQuarts;
  const visibleAddOns = useMemo(() => visibleItemsForTab(props.catalogItems, activeTab), [activeTab, props.catalogItems]);
  const groupedOtherItems = useMemo(() => otherCatalogGroups(props.catalogItems), [props.catalogItems]);
  const vehicleLabel = [props.specs.year, props.specs.make, props.specs.model].filter(Boolean).join(" ") || "Vehicle not set";
  const filterSuppressed = props.filterChoice === "customer_supplied" || props.filterChoice === "no_filter";
  const displayedFilter = filterSuppressed ? null : props.selectedOilFilter ?? props.oilFilterSuggestion;
  const hasFilterSuggestion = Boolean(displayedFilter && displayedFilter.source !== "none");
  const oilTypeHint = (props.specs.oil_type || props.oilTypeOverride).toLowerCase();
  const recommendedPackageId = props.packages.find((servicePackage) => {
    const packageOil = `${servicePackage.oil_brand ?? ""} ${servicePackage.oil_type ?? ""} ${servicePackage.name}`.toLowerCase();
    return oilTypeHint && packageOil.includes(oilTypeHint.replace("mobil 1", "mobil").split(/\s+/)[0]);
  })?.id;
  const quartsSourceLabel = props.quartsSuggestionSource === "vehicle_default"
    ? "Suggested from vehicle history"
    : props.quartsSuggestionSource === "last_service"
      ? "Suggested from last service"
      : "Suggested from package default";

  return (
    <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-[var(--pos-text)]">Servicing</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--pos-muted)]">Select an oil package, configure quarts/filter, then add services or fees.</p>
            </div>
            <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-4 py-3 text-sm">
              <div className="font-bold text-[var(--pos-text)]">{props.selectedCustomer ? `${props.selectedCustomer.first_name} ${props.selectedCustomer.last_name}` : "Customer pending"}</div>
              <div className="mt-1 text-[var(--pos-muted)]">{vehicleLabel}</div>
            </div>
          </div>
          {props.validation ? <div className="mt-4 rounded-xl border border-[var(--pos-danger)]/35 bg-red-500/10 p-3 text-sm font-semibold text-[var(--pos-danger)]">{props.validation}</div> : null}

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {categoryTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`min-h-12 shrink-0 rounded-xl border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] ${activeTab === tab ? "border-[var(--pos-blue)] bg-[var(--pos-blue)] text-white shadow-[0_0_22px_rgba(11,124,255,0.28)]" : "border-[var(--pos-border)] bg-[var(--pos-panel-2)] text-[var(--pos-muted)] hover:border-[var(--pos-border-strong)] hover:text-[var(--pos-text)]"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </Card>

        {activeTab === "Oil Change" ? (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--pos-text)]">Oil Change Packages</h2>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Prices come from the local service package catalog.</p>
              </div>
              {props.selectedPackage ? <span className="rounded-full border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] px-3 py-1 text-sm font-bold text-[var(--pos-blue-2)]">{props.selectedPackage.name} selected</span> : null}
            </div>

            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
              {props.packages.map((servicePackage) => {
                const selected = props.selectedPackage?.id === servicePackage.id;
                const recommended = recommendedPackageId === servicePackage.id;
                return (
                  <button
                    key={servicePackage.id}
                    onClick={() => props.onSelectPackage(servicePackage)}
                    className={`group flex min-h-[286px] flex-col rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] ${selected ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] shadow-[0_0_28px_rgba(11,124,255,0.22)]" : "border-[var(--pos-border)] bg-[var(--pos-card)]"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pos-blue-soft)] text-[var(--pos-blue-2)]">
                        <PackagePlus size={23} />
                      </div>
                      {selected ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pos-blue)] px-2.5 py-1 text-xs font-black text-white"><Check size={13} />Selected</span> : recommended ? <span className="inline-flex items-center gap-1 rounded-full border border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] px-2.5 py-1 text-xs font-black text-[var(--pos-blue-2)]">Recommended</span> : null}
                    </div>
                    <div className="mt-4 min-h-[72px]">
                      <div className="text-lg font-black leading-tight text-[var(--pos-text)]">{servicePackage.name}</div>
                      <div className="mt-2 line-clamp-1 text-xs font-black tracking-wide text-[var(--pos-blue-2)]">{packageSubhead(servicePackage) || "OIL CHANGE"}</div>
                    </div>
                    <div className="mt-1 text-3xl font-black text-[var(--pos-text)]">{formatMoney(servicePackage.base_price)} <span className="text-sm font-bold text-[var(--pos-muted)]">base</span></div>
                    {servicePackage.description ? <p className="mt-3 line-clamp-2 text-sm text-[var(--pos-muted)]">{servicePackage.description}</p> : null}
                    <div className="mt-4 space-y-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--pos-muted)]">Included:</span><span className="font-bold text-[var(--pos-text)]">{formatQuarts(servicePackage.included_quarts)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--pos-muted)]">Extra qt:</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(servicePackage.extra_quart_price)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-[var(--pos-muted)]">Cartridge:</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(servicePackage.cartridge_filter_extra_fee)}</span></div>
                    </div>
                    <span className={`mt-auto flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-black transition ${selected ? "bg-[var(--pos-blue)] text-white" : "border border-[var(--pos-border-strong)] bg-[var(--pos-panel-2)] text-[var(--pos-text)] group-hover:border-[var(--pos-blue)] group-hover:text-[var(--pos-blue-2)]"}`}>
                      {selected ? "Selected" : "Select Package"}
                    </span>
                  </button>
                );
              })}
            </div>

            {props.selectedPackage ? (
              <div className="mt-5 rounded-2xl border border-[var(--pos-border-strong)] bg-[var(--pos-panel-2)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-[var(--pos-text)]">Package Configuration</h3>
                    <p className="mt-1 text-sm text-[var(--pos-muted)]">Configure oil quantity and filter type before review.</p>
                  </div>
                  {hasInvalidQuarts ? <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm font-bold text-[var(--pos-danger)]">Actual quarts required</span> : null}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[180px_240px_minmax(240px,1fr)]">
                  <Input
                    label="Actual quarts"
                    inputSize="touch"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={props.actualQuarts}
                    onChange={(event) => props.onActualQuartsChange(event.target.value)}
                    helperText={`${quartsSourceLabel}. Included: ${formatQuarts(props.selectedPackage.included_quarts)}`}
                    errorText={hasInvalidQuarts ? "Enter quarts." : undefined}
                  />
                  <label className="block text-sm font-semibold text-[var(--pos-text)]">
                    Filter type
                    <select
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-base text-[var(--pos-text)] outline-none transition focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]"
                      value={props.filterType}
                      onChange={(event) => props.onFilterTypeChange(event.target.value as PackageFilterType)}
                    >
                      {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 text-sm">
                    <div className="font-black text-[var(--pos-text)]">Live package math</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="flex justify-between gap-3"><span className="text-[var(--pos-muted)]">Included:</span><span className="font-bold text-[var(--pos-text)]">{formatQuarts(props.pricing.includedQuarts)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-[var(--pos-muted)]">Actual:</span><span className="font-bold text-[var(--pos-text)]">{formatQuarts(props.pricing.actualQuarts)}</span></div>
                      <div className="flex justify-between gap-3 sm:col-span-2"><span className="text-[var(--pos-muted)]">Extra:</span><span className="font-bold text-[var(--pos-text)]">{formatQuarts(props.pricing.extraQuarts)} × {formatMoney(props.selectedPackage.extra_quart_price)} = {formatMoney(props.pricing.extraQuartTotal)}</span></div>
                      {props.pricing.filterFee > 0 ? <div className="flex justify-between gap-3 sm:col-span-2"><span className="text-[var(--pos-muted)]">Cartridge fee:</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.filterFee)}</span></div> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)]">
                  <Input
                    label="Oil type override"
                    inputSize="touch"
                    placeholder={props.selectedPackage.oil_type ?? props.specs.oil_type ?? "Oil type"}
                    value={props.oilTypeOverride}
                    onChange={(event) => props.onOilTypeOverrideChange(event.target.value)}
                    helperText={props.serviceDefaultsMessage ?? "Use when the vehicle needs a different oil than the selected package."}
                  />
                  <div className={`rounded-2xl border p-4 ${hasFilterSuggestion ? "border-[var(--pos-border-strong)] bg-[var(--pos-panel)]" : "border-[var(--pos-warning)]/40 bg-yellow-500/10"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black uppercase tracking-wide text-[var(--pos-muted)]">Suggested Oil Filter</div>
                        <div className="mt-1 font-black text-[var(--pos-text)]">{hasFilterSuggestion ? (displayedFilter?.sku ?? displayedFilter?.productId ?? "Filter") : "No saved oil filter found for this vehicle."}</div>
                        {hasFilterSuggestion ? <div className="mt-1 font-bold text-[var(--pos-text)]">{displayedFilter?.name ?? "Oil filter"}</div> : null}
                        <div className="mt-1 text-sm text-[var(--pos-muted)]">
                          {hasFilterSuggestion ? `${displayedFilter?.brand ?? "No vendor"} · Source: ${displayedFilter?.source ?? "none"} · Confidence: ${displayedFilter?.confidence ?? "none"}` : "Search local inventory or mark customer supplied/no filter."}
                        </div>
                        <div className="mt-1 text-sm text-[var(--pos-muted)]">
                          {props.filterChoice === "customer_supplied" ? "Customer supplied filter selected." : props.filterChoice === "no_filter" ? "No filter selected." : displayedFilter?.message ?? "No saved filter found."}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-[var(--pos-text)]">{displayedFilter?.retailPrice !== undefined ? formatMoney(displayedFilter.retailPrice) : "Included"}</div>
                        <div className="text-sm text-[var(--pos-muted)]">{displayedFilter?.quantityOnHand !== undefined ? `${displayedFilter.quantityOnHand} on hand` : "Inventory not matched"}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {hasFilterSuggestion ? <Button size="sm" variant="secondary" onClick={props.onUseSuggestedFilter}>Use This Filter</Button> : <Button size="sm" variant="secondary" onClick={props.onOpenOilFilterSearch}>Search Oil Filters</Button>}
                      <Button size="sm" variant="ghost" onClick={props.onOpenOilFilterSearch}>Change Filter</Button>
                      <Button size="sm" variant="ghost" onClick={props.onCustomerSuppliedFilter}>Customer Supplied</Button>
                      <Button size="sm" variant="ghost" onClick={props.onNoFilter}>No Filter</Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        {activeTab !== "Oil Change" && activeTab !== "Custom" ? (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[var(--pos-text)]">{activeTab}</h2>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Add services, fees, and supplies to the ticket.</p>
              </div>
            </div>
            {visibleAddOns.length === 0 ? <div className="mt-5"><EmptyState title="No items in this category" message="Use Custom or Settings to add catalog items for this category." /></div> : null}
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              {visibleAddOns.map((item) => {
                const index = getAddOnIndex(props.lines, item);
                const selectedLine = index >= 0 ? props.lines[index] : null;
                return (
                  <div key={item.id} className={`rounded-2xl border p-4 transition ${selectedLine ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-card)] hover:border-[var(--pos-border-strong)] hover:bg-[var(--pos-card-hover)]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-black text-[var(--pos-text)]">{item.name}</div>
                        <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.category}</div>
                      </div>
                      <div className="shrink-0 text-lg font-black text-[var(--pos-text)]">{formatMoney(item.base_price)}</div>
                    </div>
                    {selectedLine ? (
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)]">
                          <button className="flex h-11 w-11 items-center justify-center text-[var(--pos-text)] hover:text-[var(--pos-blue-2)]" onClick={() => props.onQuantityChange(index, selectedLine.quantity - 1)} aria-label={`Decrease ${item.name}`}><Minus size={17} /></button>
                          <span className="min-w-10 text-center font-black text-[var(--pos-text)]">{selectedLine.quantity}</span>
                          <button className="flex h-11 w-11 items-center justify-center text-[var(--pos-text)] hover:text-[var(--pos-blue-2)]" onClick={() => props.onQuantityChange(index, selectedLine.quantity + 1)} aria-label={`Increase ${item.name}`}><Plus size={17} /></button>
                        </div>
                        <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--pos-border)] text-[var(--pos-muted)] hover:border-[var(--pos-danger)] hover:text-[var(--pos-danger)]" onClick={() => props.onRemoveLine(index)} aria-label={`Remove ${item.name}`}><Trash2 size={17} /></button>
                      </div>
                    ) : (
                      <Button className="mt-4 w-full" variant="secondary" icon={<Plus size={16} />} onClick={() => props.onAddCatalogItem(item)}>Add</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        {activeTab === "Custom" ? (
          <Card className="p-5 sm:p-6">
            <h2 className="text-xl font-black text-[var(--pos-text)]">Custom Item</h2>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Add a one-off service, part, fee, or discount.</p>
            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_110px_140px_120px_auto]">
              <Input label="Item name" inputSize="touch" placeholder="Name" value={props.customLine.name} onChange={(event) => props.onCustomLineChange({ ...props.customLine, name: event.target.value })} />
              <Input label="Quantity" inputSize="touch" type="number" min="1" value={props.customLine.quantity} onChange={(event) => props.onCustomLineChange({ ...props.customLine, quantity: event.target.value })} />
              <Input label="Unit price" inputSize="touch" type="number" min="0" step="0.01" placeholder="Price" value={props.customLine.unit_price} onChange={(event) => props.onCustomLineChange({ ...props.customLine, unit_price: event.target.value })} />
              <label className="mt-7 flex h-12 items-center gap-2 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-3 text-sm font-semibold text-[var(--pos-text)]">
                <input type="checkbox" checked={props.customLine.taxable} onChange={(event) => props.onCustomLineChange({ ...props.customLine, taxable: event.target.checked })} />
                Taxable
              </label>
              <Button className="mt-7" variant="secondary" icon={<Plus size={16} />} onClick={props.onAddCustomLine}>Add</Button>
            </div>
          </Card>
        ) : null}

        <Card className="p-5 sm:p-6">
          <details>
            <summary className="cursor-pointer text-xl font-black text-[var(--pos-text)]">Notes</summary>
            <div className="mt-4 grid gap-3">
              <Input label="Customer Concern" inputSize="touch" placeholder="Customer Concern" value={props.customerConcern} onChange={(event) => props.onNotesChange({ customerConcern: event.target.value, technicianNotes: props.technicianNotes, internalNotes: props.internalNotes })} />
              <Input label="Technician Notes" inputSize="touch" placeholder="Technician Notes" value={props.technicianNotes} onChange={(event) => props.onNotesChange({ customerConcern: props.customerConcern, technicianNotes: event.target.value, internalNotes: props.internalNotes })} />
              <Input label="Internal Notes" inputSize="touch" placeholder="Internal Notes" value={props.internalNotes} onChange={(event) => props.onNotesChange({ customerConcern: props.customerConcern, technicianNotes: props.technicianNotes, internalNotes: event.target.value })} />
            </div>
          </details>
        </Card>

        {activeTab === "Oil Change" ? (
          <Card className="p-5 sm:p-6">
            <h2 className="text-xl font-black text-[var(--pos-text)]">Other Add-Ons</h2>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Quick access to all catalog services and fees.</p>
            <div className="mt-4 space-y-4">
              {Object.entries(groupedOtherItems).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">{category}</h3>
                  <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
                    {items.map((item) => {
                      const index = getAddOnIndex(props.lines, item);
                      const selectedLine = index >= 0 ? props.lines[index] : null;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectedLine ? undefined : props.onAddCatalogItem(item)}
                          className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] ${selectedLine ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-panel-2)] hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)]"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-bold text-[var(--pos-text)]">{item.name}</span>
                            <span className="shrink-0 font-black text-[var(--pos-text)]">{selectedLine ? `× ${selectedLine.quantity}` : formatMoney(item.base_price)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <aside className="min-w-0 2xl:sticky 2xl:top-4 2xl:h-fit">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-5">
            <h2 className="text-xl font-black text-[var(--pos-text)]">Ticket Summary</h2>
            <div className="mt-3 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-sm">
              <div className="font-bold text-[var(--pos-text)]">{props.selectedCustomer ? `${props.selectedCustomer.first_name} ${props.selectedCustomer.last_name}` : "No customer selected"}</div>
              <div className="mt-1 text-[var(--pos-muted)]">{vehicleLabel}</div>
              {props.specs.mileage ? <div className="mt-1 text-[var(--pos-muted)]">Mileage: {Number(props.specs.mileage).toLocaleString()}</div> : null}
            </div>
          </div>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto p-5 2xl:max-h-[calc(100vh-360px)]">
            {props.lines.length === 0 ? <EmptyState title="No items selected" message="Add a package, add-on, fee, discount, or custom item." /> : null}
            {props.lines.map((line, index) => {
              const locked = isLockedPackageLine(line);
              return (
                <div key={`${line.name}-${index}`} className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-4">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-black text-[var(--pos-text)]">{line.name}</div>
                      <div className="mt-1 text-sm text-[var(--pos-muted)]">{line.item_type ?? "item"} · {formatMoney(line.unit_price)} each</div>
                    </div>
                    {!locked ? (
                      <button onClick={() => props.onRemoveLine(index)} className="shrink-0 text-[var(--pos-muted)] hover:text-[var(--pos-danger)]" aria-label={`Remove ${line.name}`}>
                        <Trash2 size={18} />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                    {!locked ? (
                      <div className="flex items-center rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)]">
                        <button className="flex h-10 w-10 items-center justify-center text-[var(--pos-text)] hover:text-[var(--pos-blue-2)]" onClick={() => props.onQuantityChange(index, line.quantity - 1)} aria-label={`Decrease ${line.name}`}><Minus size={16} /></button>
                        <span className="min-w-10 text-center font-black text-[var(--pos-text)]">{line.quantity}</span>
                        <button className="flex h-10 w-10 items-center justify-center text-[var(--pos-text)] hover:text-[var(--pos-blue-2)]" onClick={() => props.onQuantityChange(index, line.quantity + 1)} aria-label={`Increase ${line.name}`}><Plus size={16} /></button>
                      </div>
                    ) : <div className="text-sm font-bold text-[var(--pos-muted)]">Qty {line.quantity}</div>}
                    <div className="text-right font-black text-[var(--pos-text)]">{formatMoney(lineTotal(line))}</div>
                  </div>
                  {!locked ? (
                    <Input className="mt-3" type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => props.onPriceChange(index, Number(event.target.value))} aria-label={`${line.name} price`} />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Package base</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.packageBase)}</span></div>
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Extra quarts</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.extraQuartTotal)}</span></div>
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Filter fee</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.filterFee)}</span></div>
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Add-ons</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.addonsTotal)}</span></div>
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Fees</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.feesTotal)}</span></div>
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Discounts</span><span className="font-bold text-[var(--pos-text)]">-{formatMoney(props.pricing.discountsTotal)}</span></div>
              <div className="flex justify-between gap-3 text-[var(--pos-muted)]"><span>Tax</span><span className="font-bold text-[var(--pos-text)]">{formatMoney(props.pricing.taxTotal)}</span></div>
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--pos-border)] pt-3">
                <span className="text-base font-black text-[var(--pos-text)]">Total</span>
                <span className="text-3xl font-black text-[var(--pos-blue-2)]">{formatMoney(props.pricing.total)}</span>
              </div>
            </div>
            {hasInvalidQuarts ? <div className="mt-3 rounded-xl border border-[var(--pos-danger)]/35 bg-red-500/10 p-3 text-sm font-semibold text-[var(--pos-danger)]">Enter actual quarts greater than 0.</div> : null}
            {props.lines.length === 0 ? <div className="mt-3 rounded-xl border border-[var(--pos-warning)]/40 bg-yellow-500/10 p-3 text-sm font-semibold text-[var(--pos-warning)]">Add at least one package, service, fee, or custom item.</div> : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={props.onPrevious}>Previous</Button>
              <Button onClick={props.onNext} disabled={!canContinue}>Continue to Review</Button>
            </div>
            <Button className="mt-3 w-full" size="touch" onClick={props.onStartService} disabled={!canContinue}>Start Service</Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}
