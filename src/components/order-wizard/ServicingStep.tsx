import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { formatMoney } from "../../lib/utils/money";
import type { ServiceCatalogItem } from "../../types/catalog";
import type { PackageFilterType, ServicePackage } from "../../types/servicePackage";
import type { TicketLineInput } from "../../types/ticket";
import type { PackagePricingBreakdown } from "../../lib/utils/pricing";
import type { CustomLineForm } from "./orderWizardTypes";

interface ServicingStepProps {
  packages: ServicePackage[];
  catalogItems: ServiceCatalogItem[];
  selectedPackage: ServicePackage | null;
  actualQuarts: string;
  filterType: PackageFilterType;
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
  onAddCatalogItem: (item: ServiceCatalogItem) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onPriceChange: (index: number, price: number) => void;
  onRemoveLine: (index: number) => void;
  onCustomLineChange: (line: CustomLineForm) => void;
  onAddCustomLine: () => void;
  onNotesChange: (notes: { customerConcern: string; technicianNotes: string; internalNotes: string }) => void;
  onPrevious: () => void;
  onNext: () => void;
}

const filterOptions: { value: PackageFilterType; label: string }[] = [
  { value: "standard", label: "Standard filter" },
  { value: "cartridge", label: "Cartridge filter" },
  { value: "customer_supplied", label: "Customer supplied" },
  { value: "none", label: "No filter" }
];

function groupedCatalog(items: ServiceCatalogItem[]) {
  return items.reduce<Record<string, ServiceCatalogItem[]>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});
}

export function ServicingStep(props: ServicingStepProps) {
  const groups = groupedCatalog(props.catalogItems);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-slate-950">Servicing</h1>
          <p className="mt-1 text-sm text-slate-500">Select an oil package, configure quarts and filter, then add services or fees.</p>
          {props.validation ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{props.validation}</div> : null}

          <h2 className="mt-6 text-lg font-bold text-slate-950">Oil Change Packages</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {props.packages.map((servicePackage) => {
              const selected = props.selectedPackage?.id === servicePackage.id;
              return (
                <button
                  key={servicePackage.id}
                  onClick={() => props.onSelectPackage(servicePackage)}
                  className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-light)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-primary-light)] ${selected ? "border-[var(--brand-primary)] bg-[var(--brand-primary-light)]" : "border-[var(--brand-border)]"}`}
                >
                  <PackagePlus className="text-[var(--brand-primary)]" size={24} />
                  <div className="mt-3 font-bold text-slate-950">{servicePackage.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {[servicePackage.oil_brand, servicePackage.oil_type].filter(Boolean).join(" / ")}
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><dt>Base</dt><dd className="font-semibold">{formatMoney(servicePackage.base_price)}</dd></div>
                    <div className="flex justify-between"><dt>Included</dt><dd>{servicePackage.included_quarts} qt</dd></div>
                    <div className="flex justify-between"><dt>Extra qt</dt><dd>{formatMoney(servicePackage.extra_quart_price)}</dd></div>
                    <div className="flex justify-between"><dt>Cartridge</dt><dd>{formatMoney(servicePackage.cartridge_filter_extra_fee)}</dd></div>
                  </dl>
                  <div className="mt-4 text-sm font-bold text-[var(--brand-primary)]">{selected ? "Selected" : "Select package"}</div>
                </button>
              );
            })}
          </div>

          {props.selectedPackage ? (
            <div className="mt-5 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary-light)] p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  label="Actual quarts"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={props.actualQuarts}
                  onChange={(event) => props.onActualQuartsChange(event.target.value)}
                  helperText={`${props.selectedPackage.included_quarts} quarts included.`}
                />
                <label className="text-sm font-semibold text-slate-700">
                  Filter type
                  <select
                    className="mt-2 h-12 w-full rounded-md border border-[var(--brand-border)] bg-white px-3 text-base text-[var(--brand-text)] shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-light)]"
                    value={props.filterType}
                    onChange={(event) => props.onFilterTypeChange(event.target.value as PackageFilterType)}
                  >
                    {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <div className="rounded-lg border border-blue-200 bg-white p-3 text-sm text-slate-600">
                  <div className="font-bold text-slate-950">Package math</div>
                  <div className="mt-1">Extra quarts: {props.pricing.extraQuarts}</div>
                  <div>Extra oil: {formatMoney(props.pricing.extraQuartTotal)}</div>
                  <div>Filter fee: {formatMoney(props.pricing.filterFee)}</div>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-950">Add-On Services</h2>
          <div className="mt-4 space-y-5">
            {Object.entries(groups).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{category}</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => props.onAddCatalogItem(item)}
                      className="rounded-lg border border-[var(--brand-border)] bg-white p-3 text-left shadow-sm transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-light)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-primary-light)]"
                    >
                      <div className="font-semibold text-slate-950">{item.name}</div>
                      <div className="mt-1 flex justify-between text-sm text-slate-500">
                        <span>{item.is_fee ? "Fee" : item.is_discount ? "Discount" : "Service"}</span>
                        <span>{formatMoney(item.base_price)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-950">Custom Item</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_100px_130px_120px_auto]">
            <Input label="Item name" placeholder="Name" value={props.customLine.name} onChange={(event) => props.onCustomLineChange({ ...props.customLine, name: event.target.value })} />
            <Input label="Quantity" type="number" min="1" value={props.customLine.quantity} onChange={(event) => props.onCustomLineChange({ ...props.customLine, quantity: event.target.value })} />
            <Input label="Price" type="number" min="0" step="0.01" placeholder="Price" value={props.customLine.unit_price} onChange={(event) => props.onCustomLineChange({ ...props.customLine, unit_price: event.target.value })} />
            <label className="mt-7 flex h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <input type="checkbox" checked={props.customLine.taxable} onChange={(event) => props.onCustomLineChange({ ...props.customLine, taxable: event.target.checked })} />
              Taxable
            </label>
            <Button className="mt-7" variant="secondary" icon={<Plus size={16} />} onClick={props.onAddCustomLine}>Add</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-950">Notes</h2>
          <div className="mt-4 grid gap-3">
            <Input label="Customer Concern" placeholder="Customer Concern" value={props.customerConcern} onChange={(event) => props.onNotesChange({ customerConcern: event.target.value, technicianNotes: props.technicianNotes, internalNotes: props.internalNotes })} />
            <Input label="Technician Notes" placeholder="Technician Notes" value={props.technicianNotes} onChange={(event) => props.onNotesChange({ customerConcern: props.customerConcern, technicianNotes: event.target.value, internalNotes: props.internalNotes })} />
            <Input label="Internal Notes" placeholder="Internal Notes" value={props.internalNotes} onChange={(event) => props.onNotesChange({ customerConcern: props.customerConcern, technicianNotes: props.technicianNotes, internalNotes: event.target.value })} />
          </div>
        </Card>
      </div>

      <Card className="h-fit p-6 xl:sticky xl:top-4">
        <h2 className="text-lg font-bold text-slate-950">Pricing Summary</h2>
        <div className="mt-4 space-y-3">
          {props.lines.length === 0 ? <EmptyState title="No items selected" message="Add a package, add-on, fee, discount, or custom item." /> : null}
          {props.lines.map((line, index) => (
            <div key={`${line.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{line.name}</div>
                  <div className="text-sm text-slate-500">{line.item_type ?? "item"} · {formatMoney(line.unit_price)} each</div>
                </div>
                <button onClick={() => props.onRemoveLine(index)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${line.name}`}>
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-[96px_112px_1fr] items-center gap-3">
                <Input className="w-24" type="number" min="0.1" step="0.1" value={line.quantity} onChange={(event) => props.onQuantityChange(index, Number(event.target.value))} disabled={line.item_type === "package"} />
                <Input className="w-28" type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => props.onPriceChange(index, Number(event.target.value))} disabled={line.item_type === "package" || line.name === "Extra Oil Quarts" || line.name === "Cartridge Filter Fee"} />
                <div className="text-right font-bold text-slate-950">{formatMoney(line.quantity * line.unit_price)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between text-slate-500"><span>Oil Package</span><span>{formatMoney(props.pricing.packageBase)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Extra Quarts</span><span>{formatMoney(props.pricing.extraQuartTotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Filter Fee</span><span>{formatMoney(props.pricing.filterFee)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Add-ons</span><span>{formatMoney(props.pricing.addonsTotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Fees</span><span>{formatMoney(props.pricing.feesTotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Discounts</span><span>-{formatMoney(props.pricing.discountsTotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatMoney(props.pricing.taxTotal)}</span></div>
          <div className="flex justify-between text-xl font-black text-slate-950"><span>Total</span><span>{formatMoney(props.pricing.total)}</span></div>
        </div>
        <div className="mt-6 flex justify-between gap-3">
          <Button variant="secondary" onClick={props.onPrevious}>Previous</Button>
          <Button onClick={props.onNext}>Next</Button>
        </div>
      </Card>
    </div>
  );
}
