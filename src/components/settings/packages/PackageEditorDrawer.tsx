import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { PackagePreview } from "./PackagePreview";
import { listActiveCatalogItems } from "../../../lib/db/repositories/catalogRepo";
import { getPackageCategory, PACKAGE_CATEGORY_ORDER } from "../../../lib/domain/packages/packageCategories";
import type { ServiceCatalogItem } from "../../../types/catalog";
import type { ServicePackage, ServicePackageInput } from "../../../types/servicePackage";

type PackageForm = {
  name: string;
  description: string;
  category: string;
  base_price: string;
  base_service_amount: string;
  disposal_fee_amount: string;
  disposal_fee_quantity: string;
  mileage_interval: string;
  time_interval_months: string;
  package_group_name: string;
  oil_brand: string;
  oil_type: string;
  included_quarts: string;
  extra_quart_price: string;
  cartridge_filter_extra_fee: string;
  sort_order: string;
  taxable: boolean;
  active: boolean;
  visible_in_start_ticket: boolean;
};

type SelectedService = {
  id: string | null;
  name: string;
  description?: string | null;
};

interface PackageEditorDrawerProps {
  mode: "create" | "edit";
  servicePackage: ServicePackage | null;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (input: ServicePackageInput) => Promise<void>;
}

const categoryOptions = [...PACKAGE_CATEGORY_ORDER];
const groupOptions = ["OIL CHANGE", "AIR FILTER, CABIN AIR FILTER AND WIPER BLADES", "Customer own oil and filter", "Brake Service", "Tires", "Fluid Exchange", "General Service"];
const oilBrandOptions = ["Duramax", "Mobil 1", "Castrol Edge", "Argos", "Customer supplied", "Other"];
const oilTypeOptions = ["Synthetic Blend", "Full Synthetic", "Conventional", "Diesel", "Own oil and filter", "Other"];
const fallbackServices = ["Engine Oil Drain & Refill", "Engine Oil Filter R&R", "Tire Pressure Check", "Multi-Point Inspection"];

function parseServices(servicePackage: ServicePackage | null): SelectedService[] {
  if (!servicePackage) return [];
  try {
    const parsed = servicePackage.services_json ? JSON.parse(servicePackage.services_json) as Array<Partial<SelectedService>> : [];
    if (Array.isArray(parsed) && parsed.length) {
      return parsed
        .map((service) => ({ id: service.id ?? null, name: service.name ?? "", description: service.description ?? null }))
        .filter((service) => service.name.trim());
    }
  } catch {
    // Fall back to legacy fields below.
  }
  return [
    servicePackage.service_1_name ? { id: servicePackage.service_1_id, name: servicePackage.service_1_name } : null,
    servicePackage.service_2_name ? { id: servicePackage.service_2_id, name: servicePackage.service_2_name } : null
  ].filter((service): service is SelectedService => Boolean(service));
}

function formFromPackage(servicePackage: ServicePackage | null, nextSortOrder: number): PackageForm {
  return {
    name: servicePackage?.name ?? "",
    description: servicePackage?.description ?? "",
    category: servicePackage ? getPackageCategory(servicePackage) : "Oil Changes",
    base_price: String(servicePackage?.package_total ?? servicePackage?.base_price ?? ""),
    base_service_amount: String(servicePackage?.base_service_amount ?? servicePackage?.base_price ?? ""),
    disposal_fee_amount: String(servicePackage?.disposal_fee_amount ?? 0),
    disposal_fee_quantity: String(servicePackage?.disposal_fee_quantity ?? ""),
    mileage_interval: String(servicePackage?.mileage_interval ?? ""),
    time_interval_months: String(servicePackage?.time_interval_months ?? ""),
    package_group_name: servicePackage?.package_group_name ?? "",
    oil_brand: servicePackage?.oil_brand ?? "",
    oil_type: servicePackage?.oil_type ?? "",
    included_quarts: String(servicePackage?.included_quarts ?? 6),
    extra_quart_price: String(servicePackage?.extra_quart_price ?? ""),
    cartridge_filter_extra_fee: String(servicePackage?.cartridge_filter_extra_fee ?? 0),
    sort_order: String(servicePackage?.sort_order ?? nextSortOrder),
    taxable: servicePackage?.taxable !== 0,
    active: servicePackage?.active !== 0,
    visible_in_start_ticket: servicePackage?.visible_in_start_ticket !== 0
  };
}

export function PackageEditorDrawer({ mode, servicePackage, nextSortOrder, onClose, onSave }: PackageEditorDrawerProps) {
  const [form, setForm] = useState<PackageForm>(() => formFromPackage(servicePackage, nextSortOrder));
  const [services, setServices] = useState<SelectedService[]>(() => parseServices(servicePackage));
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    listActiveCatalogItems().then(setCatalogItems).catch(() => setCatalogItems([]));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const input = useMemo<ServicePackageInput>(() => {
    const firstService = services[0] ?? null;
    const secondService = services[1] ?? null;
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "Oil Change",
      base_price: Number(form.base_price) || 0,
      package_total: Number(form.base_price) || 0,
      base_service_amount: Number(form.base_service_amount) || Number(form.base_price) || 0,
      disposal_fee_amount: Number(form.disposal_fee_amount) || 0,
      disposal_fee_quantity: form.disposal_fee_quantity ? Number(form.disposal_fee_quantity) || 0 : null,
      mileage_interval: form.mileage_interval ? Number(form.mileage_interval) || null : null,
      time_interval_months: form.time_interval_months ? Number(form.time_interval_months) || null : null,
      package_group_name: form.package_group_name.trim() || null,
      service_1_id: firstService?.id ?? null,
      service_1_name: firstService?.name ?? null,
      service_2_id: secondService?.id ?? null,
      service_2_name: secondService?.name ?? null,
      services_json: JSON.stringify(services),
      oil_brand: form.oil_brand.trim() || null,
      oil_type: form.oil_type.trim() || null,
      included_quarts: Number(form.included_quarts) || 0,
      extra_quart_price: Number(form.extra_quart_price) || 0,
      included_filter_type: servicePackage?.included_filter_type ?? "standard",
      cartridge_filter_extra_fee: Number(form.cartridge_filter_extra_fee) || 0,
      max_included_filter_cost: servicePackage?.max_included_filter_cost ?? null,
      taxable: form.taxable ? 1 : 0,
      active: form.active ? 1 : 0,
      visible_in_start_ticket: form.visible_in_start_ticket ? 1 : 0,
      sort_order: Number(form.sort_order) || 0
    };
  }, [form, servicePackage, services]);

  const validationError = !input.name
    ? "Package name is required."
    : input.base_price < 0 || input.included_quarts < 0 || input.extra_quart_price < 0 || input.cartridge_filter_extra_fee < 0
      ? "Pricing and quart values cannot be negative."
      : null;

  const update = (key: keyof PackageForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const updateCategory = (value: string) => setForm((current) => ({ ...current, category: value, package_group_name: value }));

  const addCatalogService = (item: ServiceCatalogItem) => {
    if (services.some((service) => service.id === item.id || service.name.toLowerCase() === item.name.toLowerCase())) return;
    setServices((current) => [...current, { id: item.id, name: item.name, description: item.description }]);
    setServiceSearch("");
    setServicePickerOpen(false);
  };

  const addManualService = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || services.some((service) => service.name.toLowerCase() === trimmed.toLowerCase())) return;
    setServices((current) => [...current, { id: null, name: trimmed }]);
    setServiceSearch("");
    setServicePickerOpen(false);
  };

  const moveService = (index: number, direction: -1 | 1) => {
    setServices((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const save = async () => {
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await onSave(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save package.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalogItems = catalogItems.filter((item) => {
    const query = serviceSearch.trim().toLowerCase();
    const haystack = `${item.name} ${item.category} ${item.description ?? ""}`.toLowerCase();
    return !query || haystack.includes(query);
  }).slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={mode === "create" ? "Add Oil Change Package" : "Edit Oil Change Package"}>
      <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--pos-border)] bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--pos-blue)]">Package Manager</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--pos-text)]">{mode === "create" ? "Add Oil Change Package" : "Edit Oil Change Package"}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">Create a package with pricing, oil details, and included services.</p>
          </div>
          <Button size="sm" variant="ghost" icon={<X size={20} />} aria-label="Close package editor" onClick={onClose} />
        </header>

        <div className="flex-1 overflow-auto bg-[var(--pos-bg)] p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

              <EditorSection title="Basic Info" description="Name the package and control whether it appears in new tickets.">
                <Input ref={nameRef} label="Package Name" required inputSize="touch" value={form.name} onChange={(event) => update("name", event.target.value)} errorText={!form.name.trim() && error ? "Required" : undefined} />
                <Input label="Description" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Optional internal/customer-facing description" />
                <div className="grid gap-3 md:grid-cols-3">
                  <SelectField label="Category" value={form.category} options={categoryOptions} onChange={updateCategory} />
                  <SelectField label="Group" value={form.package_group_name} options={groupOptions} onChange={(value) => update("package_group_name", value)} allowCustom />
                  <Input label="Sort Order" type="number" value={form.sort_order} onChange={(event) => update("sort_order", event.target.value)} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle label="Active" description="Inactive packages stay saved but are hidden from new tickets." checked={form.active} onChange={(checked) => update("active", checked)} />
                  <Toggle label="Visible in Start Ticket" description="Controls whether employees can select it in the package workflow." checked={form.visible_in_start_ticket} onChange={(checked) => update("visible_in_start_ticket", checked)} />
                </div>
              </EditorSection>

              <EditorSection title="Oil Details" description="Set defaults employees see when this package is selected.">
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField label="Oil Brand" value={form.oil_brand} options={oilBrandOptions} onChange={(value) => update("oil_brand", value)} allowCustom />
                  <SelectField label="Oil Type" value={form.oil_type} options={oilTypeOptions} onChange={(value) => update("oil_type", value)} allowCustom />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input label="Included Quarts" type="number" step="0.1" value={form.included_quarts} onChange={(event) => update("included_quarts", event.target.value)} />
                  <Input label="Extra Quart Price" type="number" step="0.01" value={form.extra_quart_price} onChange={(event) => update("extra_quart_price", event.target.value)} />
                  <Input label="Cartridge Fee" type="number" step="0.01" value={form.cartridge_filter_extra_fee} onChange={(event) => update("cartridge_filter_extra_fee", event.target.value)} />
                  <Input label="Mileage Interval" type="number" value={form.mileage_interval} onChange={(event) => update("mileage_interval", event.target.value)} />
                  <Input label="Time Interval (Months)" type="number" value={form.time_interval_months} onChange={(event) => update("time_interval_months", event.target.value)} />
                </div>
              </EditorSection>

              <EditorSection title="Pricing" description="Keep Droptop package totals intact while showing base service and included disposal clearly.">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input label="Package Total" required type="number" step="0.01" value={form.base_price} onChange={(event) => update("base_price", event.target.value)} />
                  <Input label="Base Service Amount" type="number" step="0.01" value={form.base_service_amount} onChange={(event) => update("base_service_amount", event.target.value)} />
                  <Input label="Disposal Fee Included" type="number" step="0.01" value={form.disposal_fee_amount} onChange={(event) => update("disposal_fee_amount", event.target.value)} />
                  <Input label="Disposal Fee Quantity" type="number" step="0.1" value={form.disposal_fee_quantity} onChange={(event) => update("disposal_fee_quantity", event.target.value)} />
                </div>
                <Toggle label="Taxable" description="Tax applies to the package line when selected on new tickets." checked={form.taxable} onChange={(checked) => update("taxable", checked)} />
                <p className="rounded-2xl bg-[var(--pos-blue-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--pos-blue)]">
                  Oil filters are priced separately from inventory. Disposal fees included in the package line should not be double charged on tickets.
                </p>
              </EditorSection>

              <EditorSection title="Included Services" description="Choose the service operations this package includes. Dragging is represented with simple move controls for reliable touch use.">
                <ServicePicker
                  catalogItems={filteredCatalogItems}
                  search={serviceSearch}
                  open={servicePickerOpen}
                  onSearch={setServiceSearch}
                  onOpenChange={setServicePickerOpen}
                  onAdd={addCatalogService}
                  onAddManual={addManualService}
                />
                {services.length ? (
                  <div className="space-y-2">
                    {services.map((service, index) => (
                      <div key={`${service.id ?? service.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--pos-border)] bg-white p-3 shadow-sm">
                        <GripVertical size={18} className="shrink-0 text-[var(--pos-muted-2)]" />
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-[var(--pos-text)]">{service.name}</div>
                          {service.description ? <div className="mt-1 line-clamp-1 text-xs font-semibold text-[var(--pos-muted)]">{service.description}</div> : null}
                        </div>
                        <Button size="sm" variant="ghost" icon={<ArrowUp size={16} />} disabled={index === 0} aria-label={`Move ${service.name} up`} onClick={() => moveService(index, -1)} />
                        <Button size="sm" variant="ghost" icon={<ArrowDown size={16} />} disabled={index === services.length - 1} aria-label={`Move ${service.name} down`} onClick={() => moveService(index, 1)} />
                        <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} aria-label={`Remove ${service.name}`} onClick={() => setServices((current) => current.filter((_, serviceIndex) => serviceIndex !== index))} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--pos-border-strong)] bg-[var(--pos-bg-soft)] p-5 text-center text-sm font-semibold text-[var(--pos-muted)]">
                    No services added yet. Add at least one service to define what this package includes.
                  </div>
                )}
              </EditorSection>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <PackagePreview servicePackage={input} services={services} />
              <div className="rounded-[var(--pos-radius-xl)] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                Package changes only affect new tickets. Existing imported, active, and completed tickets keep their saved line item prices.
              </div>
            </aside>
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--pos-border)] bg-white/95 px-6 py-4 backdrop-blur">
          <div className="text-sm font-semibold text-[var(--pos-muted)]">{validationError ?? "Ready to save package settings for future tickets."}</div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || Boolean(validationError)} onClick={() => void save()}>
              {saving ? "Saving..." : mode === "create" ? "Create Package" : "Save Changes"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function EditorSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[var(--pos-border)] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-black tracking-tight text-[var(--pos-text)]">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-[var(--pos-muted)]">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex min-h-[64px] w-full items-center justify-between gap-4 rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)] ${checked ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-bg-soft)] hover:border-[var(--pos-border-strong)]"}`}
    >
      <span>
        <span className="block text-sm font-black text-[var(--pos-text)]">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--pos-muted)]">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[var(--pos-blue)]" : "bg-[var(--pos-border-strong)]"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function SelectField({ label, value, options, onChange, allowCustom = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; allowCustom?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-[var(--pos-text)]">
      <span>{label}</span>
      <select
        className="mt-2 min-h-12 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-white px-3 text-sm font-semibold text-[var(--pos-text)] outline-none transition focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]"
        value={options.includes(value) ? value : allowCustom && value ? "__custom" : value}
        onChange={(event) => onChange(event.target.value === "__custom" ? value : event.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        {allowCustom && value && !options.includes(value) ? <option value="__custom">{value}</option> : null}
      </select>
      {allowCustom ? (
        <input
          className="mt-2 min-h-12 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] px-3 text-sm font-semibold text-[var(--pos-text)] outline-none transition placeholder:text-[var(--pos-muted-2)] focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Custom ${label.toLowerCase()}`}
        />
      ) : null}
    </label>
  );
}

function ServicePicker({
  catalogItems,
  search,
  open,
  onSearch,
  onOpenChange,
  onAdd,
  onAddManual
}: {
  catalogItems: ServiceCatalogItem[];
  search: string;
  open: boolean;
  onSearch: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: ServiceCatalogItem) => void;
  onAddManual: (name: string) => void;
}) {
  return (
    <div className="relative">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input leftIcon={<Search size={17} />} value={search} onFocus={() => onOpenChange(true)} onChange={(event) => { onSearch(event.target.value); onOpenChange(true); }} placeholder="Search service catalog..." />
        <Button variant="subtle" icon={<Plus size={17} />} onClick={() => onAddManual(search)} disabled={!search.trim()}>Add Custom</Button>
      </div>
      {open ? (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[var(--pos-border)] bg-white p-2 shadow-xl">
          {catalogItems.length ? catalogItems.map((item) => (
            <button key={item.id} type="button" className="block w-full rounded-xl px-3 py-3 text-left hover:bg-[var(--pos-blue-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]" onClick={() => onAdd(item)}>
              <span className="block font-black text-[var(--pos-text)]">{item.name}</span>
              <span className="mt-1 block text-xs font-semibold text-[var(--pos-muted)]">{item.category}{item.description ? ` · ${item.description}` : ""}</span>
            </button>
          )) : (
            <div className="p-4 text-sm font-semibold text-[var(--pos-muted)]">
              No catalog service matches. Type a name and use Add Custom.
            </div>
          )}
          {fallbackServices.filter((name) => !search.trim() || name.toLowerCase().includes(search.toLowerCase())).map((name) => (
            <button key={name} type="button" className="block w-full rounded-xl px-3 py-3 text-left hover:bg-[var(--pos-blue-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]" onClick={() => onAddManual(name)}>
              <span className="block font-black text-[var(--pos-text)]">{name}</span>
              <span className="mt-1 block text-xs font-semibold text-[var(--pos-muted)]">Common oil-change service</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
