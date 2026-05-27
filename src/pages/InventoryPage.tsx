import { Eye, PackagePlus, Pencil, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/useToast";
import {
  countInventorySearchResults,
  createInventoryItem,
  getInventoryStats,
  searchInventoryAdvanced,
  updateInventoryItem,
  type InventoryInput,
  type InventorySearchFilters,
  type InventoryStats
} from "../lib/db/repositories/inventoryRepo";
import {
  applyCountSheetAdjustments,
  completeCountSheet,
  createCountSheet,
  listCountSheetItems,
  listCountSheets,
  updateCountedQuantity,
  type CountSheetFilter,
  type InventoryCountSheet,
  type InventoryCountSheetItem
} from "../lib/db/repositories/inventoryCountSheetsRepo";
import {
  adjustInventoryQuantity,
  listInventoryMovementsByItem,
  type InventoryMovement,
  type InventoryMovementType
} from "../lib/db/repositories/inventoryMovementsRepo";
import {
  addPurchaseOrderItem,
  createPurchaseOrder,
  listPurchaseOrderItems,
  listPurchaseOrders,
  markOrdered,
  receivePurchaseOrderItems,
  type PurchaseOrder,
  type PurchaseOrderItem
} from "../lib/db/repositories/purchaseOrdersRepo";
import {
  createSupplier,
  listSupplierNameSuggestions,
  listSuppliers,
  updateSupplier,
  type Supplier
} from "../lib/db/repositories/suppliersRepo";
import { getInventoryPermissionSet, type InventoryPermissionSet } from "../lib/security/inventoryPermissions";
import { formatMoney } from "../lib/utils/money";
import type { InventoryItem } from "../types/inventory";

const movementReasons = ["Received stock", "Manual correction", "Damaged", "Return", "Inventory count", "Other"];
type InventoryTool = "browse" | "countSheets" | "purchaseOrders" | "scanner" | "suppliers";

interface InventoryFormState {
  sku: string;
  product_id: string;
  name: string;
  product_type: string;
  category: string;
  inventory_type: string;
  barcode: string;
  brand: string;
  supplier: string;
  vendor: string;
  sequence_id: string;
  measurement: string;
  viscosity: string;
  oil_formulation: string;
  quantity_on_hand: string;
  cost: string;
  retail_price: string;
  replacement_cost: string;
  avg_cost: string;
  reorder_point: string;
  min_quantity: string;
  max_quantity: string;
  tax_exempt: boolean;
  trackable: boolean;
  sellable: boolean;
  replenishable: boolean;
  active: boolean;
  notes: string;
}

const emptyForm: InventoryFormState = {
  sku: "",
  product_id: "",
  name: "",
  product_type: "",
  category: "",
  inventory_type: "",
  barcode: "",
  brand: "",
  supplier: "",
  vendor: "",
  sequence_id: "",
  measurement: "",
  viscosity: "",
  oil_formulation: "",
  quantity_on_hand: "0",
  cost: "0",
  retail_price: "0",
  replacement_cost: "",
  avg_cost: "",
  reorder_point: "0",
  min_quantity: "",
  max_quantity: "",
  tax_exempt: false,
  trackable: true,
  sellable: true,
  replenishable: true,
  active: true,
  notes: ""
};

function formFromItem(item: InventoryItem): InventoryFormState {
  return {
    sku: item.sku ?? "",
    product_id: item.product_id ?? "",
    name: item.name,
    product_type: item.product_type ?? item.name,
    category: item.category,
    inventory_type: item.inventory_type ?? item.category,
    barcode: item.barcode ?? "",
    brand: item.brand ?? item.vendor ?? "",
    supplier: item.supplier ?? item.vendor ?? "",
    vendor: item.vendor ?? "",
    sequence_id: item.sequence_id ?? "",
    measurement: item.measurement ?? "",
    viscosity: item.viscosity ?? "",
    oil_formulation: item.oil_formulation ?? "",
    quantity_on_hand: String(item.quantity_on_hand ?? 0),
    cost: String(item.cost ?? 0),
    retail_price: String(item.retail_price ?? 0),
    replacement_cost: item.replacement_cost == null ? "" : String(item.replacement_cost),
    avg_cost: item.avg_cost == null ? "" : String(item.avg_cost),
    reorder_point: String(item.reorder_point ?? item.min_quantity ?? 0),
    min_quantity: item.min_quantity == null ? "" : String(item.min_quantity),
    max_quantity: item.max_quantity == null ? "" : String(item.max_quantity),
    tax_exempt: Boolean(item.tax_exempt),
    trackable: item.trackable !== 0,
    sellable: item.sellable !== 0,
    replenishable: item.replenishable !== 0,
    active: item.active !== 0,
    notes: item.notes ?? ""
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseRequiredNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
  return parsed;
}

function parseOptionalNumber(value: string, label: string) {
  if (!value.trim()) return null;
  return parseRequiredNumber(value, label);
}

function inputFromForm(form: InventoryFormState, existing?: InventoryItem | null): InventoryInput {
  if (!form.product_id.trim() && !form.sku.trim()) throw new Error("Product ID / SKU is required.");
  if (!form.name.trim()) throw new Error("Name is required.");
  if (!form.category.trim()) throw new Error("Category is required.");
  return {
    ...(existing ?? {}),
    sku: nullable(form.sku) ?? nullable(form.product_id),
    product_id: nullable(form.product_id) ?? nullable(form.sku),
    name: form.name.trim(),
    product_type: nullable(form.product_type) ?? form.name.trim(),
    category: form.category.trim(),
    inventory_type: nullable(form.inventory_type) ?? form.category.trim(),
    barcode: nullable(form.barcode),
    brand: nullable(form.brand) ?? nullable(form.vendor),
    supplier: nullable(form.supplier) ?? nullable(form.vendor),
    vendor: nullable(form.vendor) ?? nullable(form.brand) ?? nullable(form.supplier),
    measurement: nullable(form.measurement),
    viscosity: nullable(form.viscosity),
    oil_formulation: nullable(form.oil_formulation),
    quantity_on_hand: parseRequiredNumber(form.quantity_on_hand, "Quantity on hand"),
    cost: parseRequiredNumber(form.cost, "Cost"),
    retail_price: parseRequiredNumber(form.retail_price, "Retail price"),
    replacement_cost: parseOptionalNumber(form.replacement_cost, "Replacement cost"),
    avg_cost: parseOptionalNumber(form.avg_cost, "Average cost"),
    reorder_point: parseRequiredNumber(form.reorder_point, "Reorder point"),
    min_quantity: parseOptionalNumber(form.min_quantity, "Minimum quantity"),
    max_quantity: parseOptionalNumber(form.max_quantity, "Maximum quantity"),
    tax_exempt: form.tax_exempt ? 1 : 0,
    trackable: form.trackable ? 1 : 0,
    sellable: form.sellable ? 1 : 0,
    replenishable: form.replenishable ? 1 : 0,
    active: form.active ? 1 : 0,
    notes: nullable(form.notes),
    external_source: existing?.external_source ?? null,
    external_id: existing?.external_id ?? null,
    is_imported: existing?.is_imported ?? 0,
    original_import_json: existing?.original_import_json ?? null,
    quantity_sold_last_30_days: existing?.quantity_sold_last_30_days ?? null,
    sequence_id: nullable(form.sequence_id) ?? existing?.sequence_id ?? null
  };
}

function lowStock(item: InventoryItem) {
  const reorder = Number(item.reorder_point) || 0;
  const min = Number(item.min_quantity) || 0;
  if (reorder > 0 && item.quantity_on_hand <= reorder) return true;
  if (min > 0 && item.quantity_on_hand <= min) return true;
  return item.trackable !== 0 && item.quantity_on_hand === 0;
}

function margin(item: InventoryItem) {
  const dollars = (Number(item.retail_price) || 0) - (Number(item.cost) || 0);
  const percent = item.retail_price > 0 ? (dollars / item.retail_price) * 100 : 0;
  return { dollars, percent };
}

function itemLabel(item: InventoryItem) {
  return item.product_id ?? item.sku ?? item.id;
}

function itemCategory(item: InventoryItem) {
  return item.inventory_type ?? item.category;
}

function filterTitle(filter: keyof InventorySearchFilters | null) {
  const labels: Partial<Record<keyof InventorySearchFilters, string>> = {
    lowStock: "Low Stock",
    oilFilters: "Oil Filters",
    engineOil: "Engine Oil",
    airFilters: "Air Filters",
    cabinFilters: "Cabin Filters",
    wipers: "Wipers",
    fluids: "Fluids",
    imported: "Imported",
    active: "Active",
    inactive: "Inactive"
  };
  return filter ? labels[filter] ?? "Inventory" : "Inventory";
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70 p-4">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-5 py-4">
          <h2 className="text-xl font-black text-[var(--pos-text)]">{title}</h2>
          <button className="rounded-xl p-2 text-[var(--pos-muted)] hover:bg-[var(--pos-card-hover)] hover:text-[var(--pos-text)]" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
      <h3 className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue-2)]">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-sm font-semibold text-[var(--pos-text)]">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function InventoryEditModal({
  item,
  onClose,
  onSave,
  canViewFinancials
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (input: InventoryInput, item: InventoryItem | null) => Promise<void>;
  canViewFinancials: boolean;
}) {
  const [form, setForm] = useState<InventoryFormState>(() => item ? formFromItem(item) : emptyForm);
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<InventoryFormState>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(inputFromForm(form, item), item);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={item ? "Edit Inventory Item" : "Add Inventory Item"} onClose={onClose}>
      <div className="space-y-4">
        <FormSection title="Identity">
          <Input label="Product ID / SKU" inputSize="touch" value={form.product_id} onChange={(event) => update({ product_id: event.target.value, sku: event.target.value })} />
          <Input label="Product Type / Name" inputSize="touch" value={form.name} onChange={(event) => update({ name: event.target.value, product_type: event.target.value })} />
          <Input label="Inventory Type / Category" inputSize="touch" value={form.category} onChange={(event) => update({ category: event.target.value, inventory_type: event.target.value })} />
          <Input label="UPC / Barcode" inputSize="touch" value={form.barcode} onChange={(event) => update({ barcode: event.target.value })} />
          <Input label="Brand" inputSize="touch" value={form.brand} onChange={(event) => update({ brand: event.target.value })} />
          <Input label="Supplier / Vendor" inputSize="touch" value={form.vendor} onChange={(event) => update({ vendor: event.target.value, supplier: event.target.value })} />
          <Input label="Sequence ID" inputSize="touch" value={form.sequence_id} onChange={(event) => update({ sequence_id: event.target.value })} />
          <Input label="Measurement" inputSize="touch" value={form.measurement} onChange={(event) => update({ measurement: event.target.value })} />
          <Input label="Viscosity" inputSize="touch" value={form.viscosity} onChange={(event) => update({ viscosity: event.target.value })} />
          <Input label="Oil Formulation" inputSize="touch" value={form.oil_formulation} onChange={(event) => update({ oil_formulation: event.target.value })} />
        </FormSection>
        <FormSection title="Pricing">
          {canViewFinancials ? <Input label="Cost" inputSize="touch" type="number" step="0.01" value={form.cost} onChange={(event) => update({ cost: event.target.value })} /> : null}
          <Input label="Retail Price" inputSize="touch" type="number" step="0.01" value={form.retail_price} onChange={(event) => update({ retail_price: event.target.value })} />
          {canViewFinancials ? <Input label="Replacement Cost" inputSize="touch" type="number" step="0.01" value={form.replacement_cost} onChange={(event) => update({ replacement_cost: event.target.value })} /> : null}
          {canViewFinancials ? <Input label="Average Cost" inputSize="touch" type="number" step="0.01" value={form.avg_cost} onChange={(event) => update({ avg_cost: event.target.value })} /> : null}
        </FormSection>
        <FormSection title="Stock">
          <Input label="Quantity On Hand" inputSize="touch" type="number" step="0.1" value={form.quantity_on_hand} onChange={(event) => update({ quantity_on_hand: event.target.value })} />
          <Input label="Reorder Point" inputSize="touch" type="number" step="0.1" value={form.reorder_point} onChange={(event) => update({ reorder_point: event.target.value })} />
          <Input label="Min Quantity" inputSize="touch" type="number" step="0.1" value={form.min_quantity} onChange={(event) => update({ min_quantity: event.target.value })} />
          <Input label="Max Quantity" inputSize="touch" type="number" step="0.1" value={form.max_quantity} onChange={(event) => update({ max_quantity: event.target.value })} />
        </FormSection>
        <FormSection title="Flags">
          <ToggleField label="Trackable" checked={form.trackable} onChange={(trackable) => update({ trackable })} />
          <ToggleField label="Sellable" checked={form.sellable} onChange={(sellable) => update({ sellable })} />
          <ToggleField label="Replenishable" checked={form.replenishable} onChange={(replenishable) => update({ replenishable })} />
          <ToggleField label="Tax Exempt" checked={form.tax_exempt} onChange={(tax_exempt) => update({ tax_exempt })} />
          <ToggleField label="Active" checked={form.active} onChange={(active) => update({ active })} />
        </FormSection>
        <section className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
          <h3 className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue-2)]">Notes</h3>
          <textarea className="mt-4 min-h-28 w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-[var(--pos-text)] outline-none focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]" value={form.notes} onChange={(event) => update({ notes: event.target.value })} />
        </section>
        {item ? (
          <section className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue-2)]">Import Source</h3>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-[var(--pos-muted)]">Imported</div><div className="mt-1 font-black text-[var(--pos-text)]">{item.is_imported ? "Yes" : "No"}</div></div>
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-[var(--pos-muted)]">External source</div><div className="mt-1 font-black text-[var(--pos-text)]">{item.external_source ?? "-"}</div></div>
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-[var(--pos-muted)]">External ID</div><div className="mt-1 font-black text-[var(--pos-text)]">{item.external_id ?? "-"}</div></div>
            </div>
            {item.original_import_json ? (
              <details className="mt-4 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-xs text-[var(--pos-muted)]">
                <summary className="cursor-pointer font-bold text-[var(--pos-text)]">Original import JSON</summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap">{item.original_import_json}</pre>
              </details>
            ) : null}
          </section>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function AdjustQuantityModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [movementType, setMovementType] = useState<InventoryMovementType>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Received stock");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const quantityNumber = Number(quantity) || 0;
  const rawPreview = movementType === "add" ? item.quantity_on_hand + quantityNumber : movementType === "remove" ? item.quantity_on_hand - quantityNumber : quantityNumber;
  const preview = Math.max(rawPreview, 0);

  const save = async () => {
    setSaving(true);
    try {
      if (rawPreview < 0 && !window.confirm("This adjustment would make quantity negative. Set quantity to 0 instead?")) {
        setSaving(false);
        return;
      }
      await adjustInventoryQuantity({ inventory_item_id: item.id, movement_type: movementType, quantity: quantityNumber, reason, notes: notes.trim() || null, created_by: null });
      notify({ tone: "success", title: "Quantity adjusted", message: `${item.name}: ${item.quantity_on_hand} → ${preview}` });
      onSaved();
    } catch (error) {
      notify({ tone: "error", title: "Quantity adjustment failed", message: error instanceof Error ? error.message : "Unable to adjust quantity." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Adjust Quantity" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm text-[var(--pos-muted)]">Current quantity</div>
          <div className="mt-2 text-4xl font-black text-[var(--pos-text)]">{item.quantity_on_hand}</div>
          <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.product_id ?? item.sku ?? item.name}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-[var(--pos-muted)]">New quantity</div>
          <div className="mt-2 text-4xl font-black text-[var(--pos-blue-2)]">{preview}</div>
          <div className="mt-1 text-sm text-[var(--pos-muted)]">Preview after adjustment</div>
        </Card>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-[var(--pos-text)]">
          Adjustment type
          <select className="mt-2 h-12 w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-[var(--pos-text)]" value={movementType} onChange={(event) => setMovementType(event.target.value as InventoryMovementType)}>
            <option value="add">Add stock</option>
            <option value="remove">Remove stock</option>
            <option value="set">Set exact quantity</option>
          </select>
        </label>
        <div>
          <Input label="Quantity" inputSize="touch" type="number" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[-5, -1, 1, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setQuantity((value) => String(Math.max((Number(value) || 0) + delta, 0)))}
                className="min-h-12 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-sm font-black text-[var(--pos-text)]"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm font-semibold text-[var(--pos-text)]">
          Reason
          <select className="mt-2 h-12 w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-[var(--pos-text)]" value={reason} onChange={(event) => setReason(event.target.value)}>
            {movementReasons.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <Input label="Notes" inputSize="touch" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !quantity} onClick={save}>{saving ? "Saving..." : "Save Adjustment"}</Button>
      </div>
    </ModalShell>
  );
}

function DetailsModal({
  item,
  movements,
  onClose,
  onEdit,
  onAdjust,
  canEdit,
  canAdjust,
  canViewFinancials
}: {
  item: InventoryItem;
  movements: InventoryMovement[];
  onClose: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  canEdit: boolean;
  canAdjust: boolean;
  canViewFinancials: boolean;
}) {
  const itemMargin = margin(item);
  return (
    <ModalShell title="Inventory Details" onClose={onClose}>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-black text-[var(--pos-text)]">{item.name}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.product_id ?? item.sku ?? item.id} · {item.product_type ?? item.category}</div>
              </div>
              <div className="flex gap-2">
                {item.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                {lowStock(item) ? <Badge tone="red">Low Stock</Badge> : null}
                <Badge tone={item.active ? "green" : "slate"}>{item.active ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-xs text-[var(--pos-muted)]">Quantity</div><div className="mt-1 text-xl font-black text-[var(--pos-text)]">{item.quantity_on_hand}</div></div>
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-xs text-[var(--pos-muted)]">Retail</div><div className="mt-1 text-xl font-black text-[var(--pos-text)]">{formatMoney(item.retail_price)}</div></div>
              {canViewFinancials ? <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-xs text-[var(--pos-muted)]">Cost</div><div className="mt-1 text-xl font-black text-[var(--pos-text)]">{formatMoney(item.cost)}</div></div> : null}
              {canViewFinancials ? <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-xs text-[var(--pos-muted)]">Margin</div><div className="mt-1 text-xl font-black text-[var(--pos-success)]">{formatMoney(itemMargin.dollars)} / {itemMargin.percent.toFixed(1)}%</div></div> : null}
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-xs text-[var(--pos-muted)]">Sold 30 Days</div><div className="mt-1 text-xl font-black text-[var(--pos-text)]">{item.quantity_sold_last_30_days ?? 0}</div></div>
              <div className="rounded-xl bg-[var(--pos-panel)] p-3"><div className="text-xs text-[var(--pos-muted)]">Reorder / Min</div><div className="mt-1 text-xl font-black text-[var(--pos-text)]">{item.reorder_point ?? 0} / {item.min_quantity ?? "-"}</div></div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-black text-[var(--pos-text)]">Recent Movements</h3>
            {movements.length ? (
              <div className="mt-3 divide-y divide-[var(--pos-border)]">
                {movements.map((movement) => (
                  <div key={movement.id} className="grid gap-2 py-3 text-sm md:grid-cols-[120px_1fr_100px_100px]">
                    <div className="font-bold text-[var(--pos-text)]">{movement.movement_type}</div>
                    <div className="text-[var(--pos-muted)]">{movement.reason ?? "No reason"}{movement.notes ? ` · ${movement.notes}` : ""}</div>
                    <div className="text-[var(--pos-muted)]">{movement.quantity_before} → {movement.quantity_after}</div>
                    <div className="text-[var(--pos-muted)]">{new Date(movement.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-[var(--pos-muted)]">No movement history yet.</p>}
          </Card>
          {item.original_import_json ? (
            <details className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-sm text-[var(--pos-muted)]">
              <summary className="cursor-pointer font-black text-[var(--pos-text)]">Original Import Data</summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{item.original_import_json}</pre>
            </details>
          ) : null}
        </div>
        <Card className="h-fit p-5">
          <h3 className="font-black text-[var(--pos-text)]">Actions</h3>
          <div className="mt-4 grid gap-3">
            {canEdit ? <Button icon={<Pencil size={16} />} onClick={onEdit}>Edit Item</Button> : null}
            {canAdjust ? <Button variant="secondary" icon={<PackagePlus size={16} />} onClick={onAdjust}>Adjust Quantity</Button> : null}
            {!canEdit && !canAdjust ? <p className="text-sm text-[var(--pos-muted)]">Inventory changes require manager access.</p> : null}
          </div>
        </Card>
      </div>
    </ModalShell>
  );
}

function ToolTabs({ active, permissions, onChange }: { active: InventoryTool; permissions: InventoryPermissionSet; onChange: (tool: InventoryTool) => void }) {
  const tabs: { key: InventoryTool; label: string; allowed: boolean }[] = [
    { key: "browse", label: "Browse", allowed: true },
    { key: "countSheets", label: "Count Sheets", allowed: permissions.canUseCountSheets },
    { key: "purchaseOrders", label: "Purchase Orders", allowed: permissions.canUsePurchaseOrders },
    { key: "scanner", label: "Scanner", allowed: true },
    { key: "suppliers", label: "Suppliers", allowed: permissions.canManageSuppliers }
  ];
  return (
    <Card className="p-3">
      <div className="flex flex-wrap gap-2">
        {tabs.filter((tab) => tab.allowed).map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={active === tab.key ? "primary" : "secondary"}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function CountSheetsPanel({ canAdjust }: { canAdjust: boolean }) {
  const [sheets, setSheets] = useState<InventoryCountSheet[]>([]);
  const [selected, setSelected] = useState<InventoryCountSheet | null>(null);
  const [items, setItems] = useState<InventoryCountSheetItem[]>([]);
  const [name, setName] = useState("Oil Filter Count");
  const [filterType, setFilterType] = useState<CountSheetFilter>("oil_filters");
  const [loading, setLoading] = useState(false);
  const { notify } = useToast();

  const reload = useCallback(() => {
    void listCountSheets().then(setSheets).catch(() => setSheets([]));
  }, []);

  const loadItems = useCallback((sheet: InventoryCountSheet | null) => {
    if (!sheet) {
      setItems([]);
      return;
    }
    void listCountSheetItems(sheet.id).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(reload, [reload]);
  useEffect(() => loadItems(selected), [loadItems, selected]);

  const create = async () => {
    setLoading(true);
    try {
      const sheet = await createCountSheet({ name, filter_type: filterType });
      notify({ tone: "success", title: "Count sheet created", message: sheet.name });
      setSelected(sheet);
      reload();
    } catch (error) {
      notify({ tone: "error", title: "Count sheet failed", message: error instanceof Error ? error.message : "Unable to create count sheet." });
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    if (!selected) return;
    await completeCountSheet(selected.id);
    notify({ tone: "success", title: "Count completed", message: selected.name });
    const next = { ...selected, status: "completed" as const };
    setSelected(next);
    reload();
  };

  const apply = async () => {
    if (!selected || !window.confirm("Apply counted variances to inventory quantities?")) return;
    const count = await applyCountSheetAdjustments(selected.id);
    notify({ tone: "success", title: "Adjustments applied", message: `${count} inventory movement${count === 1 ? "" : "s"} created.` });
    loadItems(selected);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <h2 className="text-xl font-black text-[var(--pos-text)]">Count Sheets</h2>
        <p className="mt-1 text-sm text-[var(--pos-muted)]">Create local counts, enter counted quantities, then apply adjustments when approved.</p>
        <div className="mt-4 grid gap-3">
          <Input label="Sheet name" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="text-sm font-semibold text-[var(--pos-text)]">
            Count type
            <select className="mt-2 h-12 w-full rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-[var(--pos-text)]" value={filterType} onChange={(event) => setFilterType(event.target.value as CountSheetFilter)}>
              <option value="oil_filters">Oil Filters</option>
              <option value="engine_oil">Engine Oil</option>
              <option value="low_stock">Low Stock</option>
              <option value="all">All Inventory</option>
            </select>
          </label>
          <Button disabled={loading || !name.trim()} onClick={create}>New Count Sheet</Button>
        </div>
        <div className="mt-5 space-y-2">
          {sheets.map((sheet) => (
            <button key={sheet.id} className={`w-full rounded-xl border p-3 text-left ${selected?.id === sheet.id ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-card)]"}`} onClick={() => setSelected(sheet)}>
              <div className="font-black text-[var(--pos-text)]">{sheet.name}</div>
              <div className="mt-1 text-xs text-[var(--pos-muted)]">{sheet.status} · {sheet.item_count ?? 0} items</div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pos-border)] p-4">
              <div>
                <h3 className="text-lg font-black text-[var(--pos-text)]">{selected.name}</h3>
                <p className="text-sm text-[var(--pos-muted)]">{selected.status} · enter counted quantities</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={selected.status === "completed"} onClick={complete}>Complete Count</Button>
                <Button disabled={!canAdjust || selected.status !== "completed"} onClick={apply}>Apply Adjustments</Button>
              </div>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-[var(--pos-panel-2)] text-left text-xs uppercase text-[var(--pos-muted)]">
                  <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Counted</th><th className="px-4 py-3">Variance</th><th className="px-4 py-3">Applied</th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--pos-border)] bg-[var(--pos-card)]">
                      <td className="px-4 py-3"><div className="font-bold text-[var(--pos-text)]">{item.product_id ?? item.sku}</div><div className="text-xs text-[var(--pos-muted)]">{item.name}</div></td>
                      <td className="px-4 py-3 text-[var(--pos-text)]">{item.expected_quantity}</td>
                      <td className="px-4 py-3"><input className="h-10 w-28 rounded-lg border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-[var(--pos-text)]" type="number" step="0.1" defaultValue={item.counted_quantity ?? ""} onBlur={async (event) => { if (event.target.value !== "") { await updateCountedQuantity(item.id, Number(event.target.value)); loadItems(selected); } }} /></td>
                      <td className="px-4 py-3 text-[var(--pos-text)]">{item.variance ?? "-"}</td>
                      <td className="px-4 py-3">{item.adjustment_applied ? <Badge tone="green">Applied</Badge> : <Badge tone="slate">Pending</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <EmptyState title="Select or create a count sheet" message="Count sheets are local and only change stock when adjustments are applied." />}
      </Card>
    </div>
  );
}

function PurchaseOrdersPanel() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [foundItems, setFoundItems] = useState<InventoryItem[]>([]);
  const [quantity, setQuantity] = useState("1");
  const { notify } = useToast();

  const reload = useCallback(() => {
    void listPurchaseOrders().then(setOrders).catch(() => setOrders([]));
    void listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => {
    if (selectedOrder) void listPurchaseOrderItems(selectedOrder.id).then(setOrderItems).catch(() => setOrderItems([]));
    else setOrderItems([]);
  }, [selectedOrder]);
  useEffect(() => {
    if (itemQuery.trim().length < 2) {
      setFoundItems([]);
      return;
    }
    void searchInventoryAdvanced(itemQuery, {}, 8, 0).then(setFoundItems).catch(() => setFoundItems([]));
  }, [itemQuery]);

  const create = async () => {
    const supplier = suppliers.find((item) => item.id === supplierId) ?? null;
    const order = await createPurchaseOrder({ supplier_id: supplier?.id ?? null, supplier_name: supplier?.name ?? "Unassigned" });
    notify({ tone: "success", title: "Purchase order created", message: order.supplier_name ?? order.id });
    setSelectedOrder(order);
    reload();
  };

  const addItem = async (item: InventoryItem) => {
    if (!selectedOrder) return;
    await addPurchaseOrderItem({ purchase_order_id: selectedOrder.id, inventory_item_id: item.id, quantity_ordered: Number(quantity) || 1, unit_cost: item.cost ?? 0 });
    notify({ tone: "success", title: "Item added to PO", message: item.name });
    setItemQuery("");
    void listPurchaseOrderItems(selectedOrder.id).then(setOrderItems);
    reload();
  };

  const receive = async () => {
    if (!selectedOrder || !window.confirm("Receive this purchase order and increase inventory quantities?")) return;
    const count = await receivePurchaseOrderItems(selectedOrder.id);
    notify({ tone: "success", title: "Purchase order received", message: `${count} item${count === 1 ? "" : "s"} received.` });
    setSelectedOrder({ ...selectedOrder, status: "received" });
    reload();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="p-5">
        <h2 className="text-xl font-black text-[var(--pos-text)]">Purchase Orders</h2>
        <p className="mt-1 text-sm text-[var(--pos-muted)]">Local purchasing workflow. No accounting integration yet.</p>
        <div className="mt-4 grid gap-3">
          <select className="h-12 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-[var(--pos-text)]" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">No supplier selected</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <Button onClick={create}>New Purchase Order</Button>
        </div>
        <div className="mt-5 space-y-2">
          {orders.map((order) => (
            <button key={order.id} className={`w-full rounded-xl border p-3 text-left ${selectedOrder?.id === order.id ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)]" : "border-[var(--pos-border)] bg-[var(--pos-card)]"}`} onClick={() => setSelectedOrder(order)}>
              <div className="font-black text-[var(--pos-text)]">{order.supplier_name ?? "Unassigned PO"}</div>
              <div className="mt-1 text-xs text-[var(--pos-muted)]">{order.status} · {order.item_count ?? 0} items</div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        {selectedOrder ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-lg font-black text-[var(--pos-text)]">{selectedOrder.supplier_name ?? selectedOrder.id}</h3><p className="text-sm text-[var(--pos-muted)]">{selectedOrder.status}</p></div>
              <div className="flex gap-2"><Button variant="secondary" disabled={selectedOrder.status !== "draft"} onClick={async () => { await markOrdered(selectedOrder.id); setSelectedOrder({ ...selectedOrder, status: "ordered" }); reload(); }}>Mark Ordered</Button><Button disabled={selectedOrder.status === "received"} onClick={receive}>Receive Items</Button></div>
            </div>
            <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                <Input label="Search inventory item" value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Product ID, SKU, name..." />
                <Input label="Qty" type="number" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
              {foundItems.length ? <div className="mt-3 grid gap-2">{foundItems.map((item) => <button key={item.id} className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3 text-left hover:border-[var(--pos-blue)]" onClick={() => addItem(item)}><span className="font-black text-[var(--pos-text)]">{item.product_id ?? item.sku}</span><span className="ml-2 text-sm text-[var(--pos-muted)]">{item.name}</span></button>)}</div> : null}
            </div>
            <div className="divide-y divide-[var(--pos-border)] rounded-2xl border border-[var(--pos-border)]">
              {orderItems.map((item) => <div key={item.id} className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_100px_100px_100px]"><div><div className="font-bold text-[var(--pos-text)]">{item.product_id}</div><div className="text-[var(--pos-muted)]">{item.name}</div></div><div className="text-[var(--pos-text)]">Qty {item.quantity_ordered}</div><div className="text-[var(--pos-muted)]">Rec {item.quantity_received}</div><div className="text-[var(--pos-text)]">{formatMoney(item.line_total)}</div></div>)}
            </div>
          </div>
        ) : <EmptyState title="Select or create a purchase order" message="Receiving a PO writes inventory movement history." />}
      </Card>
    </div>
  );
}

function ScannerPanel({ onView, onEdit, onAdjust, canEdit, canAdjust }: { onView: (item: InventoryItem) => void; onEdit: (item: InventoryItem | "new") => void; onAdjust: (item: InventoryItem) => void; canEdit: boolean; canAdjust: boolean }) {
  const [scan, setScan] = useState("");
  const [result, setResult] = useState<InventoryItem | null>(null);
  const [searched, setSearched] = useState(false);
  const classify = scan.trim().length === 17 ? "Possible VIN" : /^\d{8,14}$/.test(scan.trim()) ? "UPC / Barcode" : "Product ID / SKU";
  const runScan = async () => {
    const value = scan.trim();
    if (!value) return;
    const [item] = await searchInventoryAdvanced(value, {}, 1, 0);
    setResult(item ?? null);
    setSearched(true);
  };
  return (
    <Card className="p-5">
      <h2 className="text-xl font-black text-[var(--pos-text)]">Scanner</h2>
      <p className="mt-1 text-sm text-[var(--pos-muted)]">Keyboard-wedge scanner mode. No special driver required.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <Input inputSize="touch" value={scan} autoFocus onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runScan(); }} placeholder="Scan barcode, product ID, or VIN..." />
        <Button size="touch" onClick={runScan}>Lookup</Button>
      </div>
      <div className="mt-3 text-sm text-[var(--pos-muted)]">Detected input: {classify}</div>
      {result ? (
        <Card className="mt-5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-xl font-black text-[var(--pos-text)]">{result.product_id ?? result.sku}</div><div className="text-sm text-[var(--pos-muted)]">{result.name} · Qty {result.quantity_on_hand}</div></div>
            <div className="flex gap-2"><Button variant="secondary" onClick={() => onView(result)}>View Item</Button><Button disabled={!canAdjust} onClick={() => onAdjust(result)}>Adjust Qty</Button><Button disabled={!canEdit} onClick={() => onEdit(result)}>Edit</Button></div>
          </div>
        </Card>
      ) : searched ? (
        <EmptyState title="No item found" message="Add a new inventory item if this barcode or product ID should be stocked." action={<Button disabled={!canEdit} onClick={() => onEdit("new")}>Add New Inventory Item</Button>} />
      ) : null}
    </Card>
  );
}

function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", email: "", website: "", notes: "", active: true });
  const { notify } = useToast();
  const reload = useCallback(() => {
    void listSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    void listSupplierNameSuggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, []);
  useEffect(reload, [reload]);
  const save = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await updateSupplier(editing.id, { ...form, active: form.active ? 1 : 0 });
      notify({ tone: "success", title: "Supplier updated", message: form.name });
    } else {
      await createSupplier({ ...form, active: form.active ? 1 : 0 });
      notify({ tone: "success", title: "Supplier added", message: form.name });
    }
    setEditing(null);
    setForm({ name: "", contact_name: "", phone: "", email: "", website: "", notes: "", active: true });
    reload();
  };
  const edit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({ name: supplier.name, contact_name: supplier.contact_name ?? "", phone: supplier.phone ?? "", email: supplier.email ?? "", website: supplier.website ?? "", notes: supplier.notes ?? "", active: supplier.active !== 0 });
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card className="p-5">
        <h2 className="text-xl font-black text-[var(--pos-text)]">{editing ? "Edit Supplier" : "Add Supplier"}</h2>
        <div className="mt-4 grid gap-3">
          <Input label="Supplier name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Contact" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Input label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input label="Website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          <ToggleField label="Active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
          <Button onClick={save}>{editing ? "Save Supplier" : "Add Supplier"}</Button>
          {editing ? <Button variant="secondary" onClick={() => { setEditing(null); setForm({ name: "", contact_name: "", phone: "", email: "", website: "", notes: "", active: true }); }}>Cancel Edit</Button> : null}
        </div>
        {suggestions.length ? <div className="mt-5"><div className="text-sm font-bold text-[var(--pos-text)]">Suggested from inventory</div><div className="mt-2 flex flex-wrap gap-2">{suggestions.slice(0, 8).map((name) => <Button key={name} size="sm" variant="ghost" onClick={() => setForm({ ...form, name })}>{name}</Button>)}</div></div> : null}
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--pos-border)] p-4"><h3 className="font-black text-[var(--pos-text)]">Suppliers</h3></div>
        <div className="divide-y divide-[var(--pos-border)]">
          {suppliers.map((supplier) => <button key={supplier.id} className="grid w-full gap-2 p-4 text-left hover:bg-[var(--pos-card-hover)] md:grid-cols-[1fr_140px_120px]" onClick={() => edit(supplier)}><div><div className="font-black text-[var(--pos-text)]">{supplier.name}</div><div className="text-sm text-[var(--pos-muted)]">{supplier.contact_name ?? "No contact"} · {supplier.phone ?? supplier.email ?? "No phone/email"}</div></div><div className="text-sm text-[var(--pos-muted)]">{supplier.inventory_count ?? 0} linked items</div><div>{supplier.active ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</div></button>)}
        </div>
      </Card>
    </div>
  );
}

export function InventoryPage() {
  const [activeTool, setActiveTool] = useState<InventoryTool>("browse");
  const [permissions, setPermissions] = useState<InventoryPermissionSet>({
    role: "owner",
    canView: true,
    canEdit: true,
    canAdjust: true,
    canUseCountSheets: true,
    canUsePurchaseOrders: true,
    canManageSuppliers: true,
    canViewMetrics: true,
    canViewFinancials: true
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editingItem, setEditingItem] = useState<InventoryItem | null | "new">(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [activeFilter, setActiveFilter] = useState<keyof InventorySearchFilters | null>(null);
  const [stats, setStats] = useState<InventoryStats>({ totalItems: 0, importedItems: 0, lowStockItems: 0, oilFilters: 0, engineOils: 0, costValue: 0, retailValue: 0 });
  const [resultCount, setResultCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const filtersFor = useCallback((filter: keyof InventorySearchFilters | null): InventorySearchFilters => filter ? { [filter]: true } : {}, []);

  const refreshStats = useCallback(() => {
    void getInventoryStats().then(setStats).catch(() => undefined);
  }, []);

  const loadItems = useCallback((nextOffset = 0, append = false) => {
    setLoading(true);
    const query = debouncedSearch.trim();
    const hasSearchOrFilter = Boolean(query.length >= 2 || activeFilter);
    if (!hasSearchOrFilter) {
      setItems([]);
      setResultCount(0);
      setOffset(0);
      setLoading(false);
      return;
    }
    const filters = filtersFor(activeFilter);
    const listPromise = searchInventoryAdvanced(query, filters, 50, nextOffset);
    const countPromise = countInventorySearchResults(query, filters);
    Promise.all([listPromise, countPromise])
      .then(([rows, count]) => {
        setItems((current) => append ? [...current, ...rows] : rows);
        setResultCount(count);
        setOffset(nextOffset + rows.length);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load inventory."))
      .finally(() => setLoading(false));
  }, [activeFilter, debouncedSearch, filtersFor]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(refreshStats, [refreshStats]);
  useEffect(() => {
    void getInventoryPermissionSet().then(setPermissions).catch(() => undefined);
  }, []);
  useEffect(() => {
    loadItems(0, false);
  }, [debouncedSearch, activeFilter, loadItems]);

  useEffect(() => {
    if (!detailsItem) return;
    listInventoryMovementsByItem(detailsItem.id, 25).then(setMovements).catch(() => setMovements([]));
  }, [detailsItem]);

  const afterMutation = () => {
    refreshStats();
    loadItems(0, false);
  };

  const saveInventory = async (input: InventoryInput, item: InventoryItem | null) => {
    try {
      if (item) {
        await updateInventoryItem(item.id, input);
        notify({ tone: "success", title: "Inventory item updated", message: input.name });
      } else {
        await createInventoryItem(input);
        notify({ tone: "success", title: "Inventory item added", message: input.name });
      }
      setEditingItem(null);
      afterMutation();
    } catch (error) {
      notify({ tone: "error", title: "Inventory save failed", message: error instanceof Error ? error.message : "Unable to save inventory item." });
      throw error;
    }
  };

  const hasSearchOrFilter = Boolean(debouncedSearch.trim().length >= 2 || activeFilter);
  const filterButtons: { key: keyof InventorySearchFilters; label: string }[] = [
    { key: "oilFilters", label: "Oil Filters" },
    { key: "engineOil", label: "Engine Oil" },
    { key: "airFilters", label: "Air Filters" },
    { key: "cabinFilters", label: "Cabin Filters" },
    { key: "wipers", label: "Wipers" },
    { key: "fluids", label: "Fluids" },
    { key: "lowStock", label: "Low Stock" }
  ];
  const resultsTitle = activeFilter ? `Results for ${filterTitle(activeFilter)}` : `Results for ${debouncedSearch.trim()}`;
  const detailsWithLatest = useMemo(() => detailsItem ? items.find((item) => item.id === detailsItem.id) ?? detailsItem : null, [detailsItem, items]);
  const showBrowse = activeTool === "browse";

  return (
    <section className="space-y-5">
      <PageHeader title="Inventory" subtitle="Search parts, oil, filters, and pricing." />
      <ToolTabs active={activeTool} permissions={permissions} onChange={setActiveTool} />
      {showBrowse ? <Card className="p-5">
        <div className="relative">
          <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
          <Input inputSize="touch" className="pl-12 text-lg" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product ID, oil filter, oil type, UPC, brand, supplier..." />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {filterButtons.map((filter) => (
            <Button key={`${filter.key}-${filter.label}`} size="touch" variant={activeFilter === filter.key ? "primary" : "secondary"} icon={filter.key === "lowStock" ? <SlidersHorizontal size={16} /> : undefined} onClick={() => setActiveFilter((current) => current === filter.key ? null : filter.key)}>
              {filter.label}
            </Button>
          ))}
          {permissions.canEdit ? <Button size="touch" icon={<PackagePlus size={18} />} onClick={() => setEditingItem("new")}>Add Inventory Item</Button> : null}
        </div>
      </Card> : null}
      {showBrowse ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Total Items</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.totalItems}</div></Card>
        <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Low Stock</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.lowStockItems}</div></Card>
        <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Oil Filters</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.oilFilters}</div></Card>
        <Card className="p-4"><div className="text-sm text-[var(--pos-muted)]">Engine Oil</div><div className="mt-2 text-3xl font-black text-[var(--pos-text)]">{stats.engineOils}</div></Card>
      </div> : null}
      {error ? <Card className="p-4 text-sm text-red-200">{error}</Card> : null}
      {showBrowse && !hasSearchOrFilter ? (
        <EmptyState
          title="Search or choose a category"
          message="Use the search bar or hot buttons to find inventory items."
        />
      ) : null}
      {showBrowse && hasSearchOrFilter ? <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pos-border)] px-5 py-3 text-sm text-[var(--pos-muted)]">
          <div>
            <div className="text-base font-black text-[var(--pos-text)]">{resultsTitle}</div>
            <div>{resultCount} matching item{resultCount === 1 ? "" : "s"}</div>
          </div>
          <Button variant="secondary" onClick={() => { setSearch(""); setDebouncedSearch(""); setActiveFilter(null); }}>Clear</Button>
          {loading ? <span>Searching...</span> : null}
        </div>
        {items.length === 0 ? (
          <EmptyState title={loading ? "Loading inventory" : "No inventory items"} message="Try another product ID, oil type, UPC, brand, or supplier." />
        ) : (
          <>
            <div className="grid gap-3 p-3 md:hidden">
              {items.map((item) => {
                const isLow = lowStock(item);
                return (
                  <div key={item.id} className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-[var(--pos-text)]">{itemLabel(item)}</div>
                        <div className="mt-1 text-sm font-semibold text-[var(--pos-muted)]">{item.product_type ?? item.name}</div>
                        <div className="mt-1 text-xs text-[var(--pos-muted)]">{[item.brand ?? item.vendor, itemCategory(item), item.viscosity].filter(Boolean).join(" · ")}</div>
                      </div>
                      {isLow ? <Badge tone="red">Low Stock</Badge> : <Badge tone="slate">Qty {item.quantity_on_hand}</Badge>}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl bg-[var(--pos-panel-2)] p-3"><span className="text-[var(--pos-muted)]">Stock</span><div className="text-xl font-black">{item.quantity_on_hand}</div></div>
                      <div className="rounded-xl bg-[var(--pos-panel-2)] p-3"><span className="text-[var(--pos-muted)]">Retail</span><div className="text-xl font-black">{formatMoney(item.retail_price)}</div></div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDetailsItem(item)}>View</Button>
                      {permissions.canEdit ? <Button size="sm" variant="secondary" onClick={() => setEditingItem(item)}>Edit</Button> : null}
                      {permissions.canAdjust ? <Button size="sm" onClick={() => setAdjustingItem(item)}>Adjust</Button> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-[var(--pos-panel-2)] text-left text-xs uppercase tracking-wide text-[var(--pos-muted)]">
                <tr>
                  {["Product ID / SKU", "Item", "Stock", "Retail", "Actions"].map((heading) => (
                    <th key={heading} className="border-b border-[var(--pos-border)] px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLow = lowStock(item);
                  return (
                    <tr key={item.id} className="bg-[var(--pos-card)] hover:bg-[var(--pos-card-hover)]">
                      <td className="border-b border-[var(--pos-border)] px-4 py-3 font-semibold text-[var(--pos-text)]">
                        <div>{itemLabel(item)}</div>
                        <div className="mt-1 flex gap-1">{item.is_imported ? <Badge tone="blue">Imported</Badge> : null}{isLow ? <Badge tone="red">Low</Badge> : null}</div>
                      </td>
                      <td className="border-b border-[var(--pos-border)] px-4 py-3">
                        <div className="font-semibold text-[var(--pos-text)]">{item.product_type ?? item.name}</div>
                        <div className="text-xs text-[var(--pos-muted)]">{[item.brand ?? item.vendor, itemCategory(item), item.viscosity, item.oil_formulation].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="border-b border-[var(--pos-border)] px-4 py-3">
                        <div className="font-black text-[var(--pos-text)]">{item.quantity_on_hand}</div>
                        {isLow ? <div className="mt-1"><Badge tone="red">Low Stock</Badge></div> : null}
                      </td>
                      <td className="border-b border-[var(--pos-border)] px-4 py-3 font-bold text-[var(--pos-text)]">
                        {formatMoney(item.retail_price)}
                      </td>
                      <td className="border-b border-[var(--pos-border)] px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setDetailsItem(item)}>View</Button>
                          {permissions.canEdit ? <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditingItem(item)}>Edit</Button> : null}
                          {permissions.canAdjust ? <Button size="sm" variant="secondary" icon={<PackagePlus size={14} />} onClick={() => setAdjustingItem(item)}>Adjust</Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </>
        )}
        {hasSearchOrFilter && items.length < resultCount ? (
          <div className="border-t border-[var(--pos-border)] p-4 text-center">
            <Button variant="secondary" disabled={loading} onClick={() => loadItems(offset, true)}>Load More</Button>
          </div>
        ) : null}
      </Card> : null}
      {activeTool === "countSheets" ? <CountSheetsPanel canAdjust={permissions.canAdjust} /> : null}
      {activeTool === "purchaseOrders" ? <PurchaseOrdersPanel /> : null}
      {activeTool === "scanner" ? <ScannerPanel canEdit={permissions.canEdit} canAdjust={permissions.canAdjust} onView={setDetailsItem} onEdit={setEditingItem} onAdjust={setAdjustingItem} /> : null}
      {activeTool === "suppliers" ? <SuppliersPanel /> : null}
      {editingItem ? (
        <InventoryEditModal
          item={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSave={saveInventory}
          canViewFinancials={permissions.canViewFinancials}
        />
      ) : null}
      {adjustingItem ? (
        <AdjustQuantityModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSaved={() => {
            setAdjustingItem(null);
            afterMutation();
          }}
        />
      ) : null}
      {detailsWithLatest ? (
        <DetailsModal
          item={detailsWithLatest}
          movements={movements}
          onClose={() => setDetailsItem(null)}
          onEdit={() => {
            setEditingItem(detailsWithLatest);
            setDetailsItem(null);
          }}
          onAdjust={() => {
            setAdjustingItem(detailsWithLatest);
            setDetailsItem(null);
          }}
          canEdit={permissions.canEdit}
          canAdjust={permissions.canAdjust}
          canViewFinancials={permissions.canViewFinancials}
        />
      ) : null}
    </section>
  );
}
