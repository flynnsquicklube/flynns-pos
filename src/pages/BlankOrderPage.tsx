import { FileText, PackagePlus, Printer, RotateCcw, Save, Search, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { listActivePackages } from "../lib/db/repositories/packagesRepo";
import { addQuoteItem, createQuote, getQuoteById, removeQuoteItem, saveQuote, updateQuote, updateQuoteItem, type QuoteItem, type QuoteWithItems } from "../lib/db/repositories/quotesRepo";
import { searchInventoryAdvanced } from "../lib/db/repositories/inventoryRepo";
import { calculateQuoteTotals } from "../lib/domain/quotes/quoteTotals";
import { groupPackagesByCategory, PACKAGE_CATEGORY_ORDER } from "../lib/domain/packages/packageCategories";
import { US_STATES } from "../lib/domain/vehicles/usStates";
import { formatMoney } from "../lib/utils/money";
import type { InventoryItem } from "../types/inventory";
import type { ServicePackage } from "../types/servicePackage";

interface BlankOrderPageProps {
  onConvertToTicket: () => void;
}

type AddMode = "package" | "inventory" | "labor" | "fee" | "discount" | "custom";

const blankInfo = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  vehicle_year: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_vin: "",
  vehicle_plate: "",
  vehicle_plate_state: "OH",
  vehicle_mileage: "",
  notes: ""
};

function itemLineTotal(item: QuoteItem) {
  return Math.round(item.quantity * item.unit_price * 100) / 100;
}

function QuotePrintView({ quote }: { quote: QuoteWithItems | null }) {
  if (!quote) return null;
  return (
    <div className="hidden print:block">
      <div className="mx-auto max-w-[780px] bg-white p-8 text-black">
        <div className="flex justify-between border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-2xl font-black">Estimate / Quote</h1>
            <p className="mt-1 text-sm">Flynn's Quick Lube</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-black">{quote.quote_number}</div>
            <div>{new Date(quote.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-black uppercase">Customer</div>
            <div>{quote.customer_name || "Walk-in quote"}</div>
            <div>{quote.customer_phone || ""}</div>
            <div>{quote.customer_email || ""}</div>
          </div>
          <div>
            <div className="font-black uppercase">Vehicle</div>
            <div>{[quote.vehicle_year, quote.vehicle_make, quote.vehicle_model].filter(Boolean).join(" ") || "Vehicle not specified"}</div>
            <div>{quote.vehicle_vin ? `VIN ${quote.vehicle_vin}` : ""}</div>
            <div>{quote.vehicle_plate ? `Plate ${quote.vehicle_plate} ${quote.vehicle_plate_state ?? ""}` : ""}</div>
          </div>
        </div>
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2"><strong>{item.name}</strong><div className="text-xs text-gray-600">{item.description}</div></td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatMoney(item.unit_price)}</td>
                <td className="py-2 text-right">{formatMoney(itemLineTotal(item))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-6 w-72 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(quote.subtotal)}</strong></div>
          <div className="flex justify-between"><span>Discounts</span><strong>-{formatMoney(quote.discount_total)}</strong></div>
          <div className="flex justify-between"><span>Tax Estimate</span><strong>{formatMoney(quote.tax_total)}</strong></div>
          <div className="flex justify-between border-t border-gray-300 pt-2 text-lg"><span>Total Estimate</span><strong>{formatMoney(quote.total)}</strong></div>
        </div>
        <p className="mt-8 border-t border-gray-300 pt-3 text-xs">This is an estimate. Final pricing may change after vehicle inspection.</p>
      </div>
    </div>
  );
}

export function BlankOrderPage({ onConvertToTicket }: BlankOrderPageProps) {
  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [info, setInfo] = useState(blankInfo);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packageCategory, setPackageCategory] = useState<string>("Oil Changes");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [addMode, setAddMode] = useState<AddMode>("package");
  const [quickLine, setQuickLine] = useState({ name: "", description: "", quantity: "1", unit_price: "", discount_type: "dollar" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedPackages = useMemo(() => groupPackagesByCategory(packages), [packages]);
  const totals = useMemo(() => calculateQuoteTotals(quote?.items ?? [], 0), [quote]);

  const refreshQuote = async (id: string) => {
    const next = await getQuoteById(id);
    setQuote(next);
  };

  useEffect(() => {
    createQuote().then(setQuote).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to start blank quote."));
    listActivePackages().then(setPackages).catch(() => setPackages([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!inventorySearch.trim()) {
        setInventory([]);
        return;
      }
      searchInventoryAdvanced(inventorySearch, { active: true }, 12, 0).then(setInventory).catch(() => setInventory([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [inventorySearch]);

  const saveInfo = async () => {
    if (!quote) return;
    await updateQuote(quote.id, {
      customer_name: info.customer_name.trim() || null,
      customer_phone: info.customer_phone.trim() || null,
      customer_email: info.customer_email.trim() || null,
      vehicle_year: info.vehicle_year.trim() || null,
      vehicle_make: info.vehicle_make.trim() || null,
      vehicle_model: info.vehicle_model.trim() || null,
      vehicle_vin: info.vehicle_vin.trim().toUpperCase() || null,
      vehicle_plate: info.vehicle_plate.trim().toUpperCase() || null,
      vehicle_plate_state: info.vehicle_plate_state.trim().toUpperCase() || null,
      vehicle_mileage: Number(info.vehicle_mileage) || null,
      notes: info.notes.trim() || null
    });
    await refreshQuote(quote.id);
  };

  const addItem = async (input: Parameters<typeof addQuoteItem>[1]) => {
    if (!quote) return;
    await addQuoteItem(quote.id, input, 0);
    await refreshQuote(quote.id);
  };

  const addPackage = (servicePackage: ServicePackage) => {
    const price = Number(servicePackage.package_total ?? servicePackage.base_price) || 0;
    void addItem({
      item_type: "package",
      name: servicePackage.name,
      description: [servicePackage.oil_brand, servicePackage.oil_type].filter(Boolean).join(" · ") || servicePackage.description,
      quantity: 1,
      unit_price: price,
      taxable: servicePackage.taxable,
      package_id: servicePackage.id,
      metadata_json: JSON.stringify({ package_total: servicePackage.package_total, external_id: servicePackage.external_id })
    });
  };

  const addInventory = (item: InventoryItem) => {
    void addItem({
      item_type: "inventory",
      name: item.name,
      description: [item.vendor ?? item.brand, item.sku ?? item.product_id].filter(Boolean).join(" · "),
      quantity: 1,
      unit_price: item.retail_price,
      taxable: item.tax_exempt ? 0 : 1,
      inventory_item_id: item.id,
      metadata_json: JSON.stringify({ sku: item.sku, product_id: item.product_id, cost: item.cost })
    });
  };

  const addQuickLine = () => {
    const amount = Number(quickLine.unit_price);
    const quantity = Number(quickLine.quantity) || 1;
    if (!quote || !quickLine.name.trim() || !Number.isFinite(amount)) return;
    const isDiscount = addMode === "discount";
    void addItem({
      item_type: addMode,
      name: quickLine.name.trim(),
      description: quickLine.description.trim() || null,
      quantity: isDiscount ? 1 : quantity,
      unit_price: isDiscount ? -Math.abs(amount) : amount,
      taxable: addMode === "discount" ? 0 : 1
    }).then(() => setQuickLine({ name: "", description: "", quantity: "1", unit_price: "", discount_type: "dollar" }));
  };

  const updateItemQuantity = async (item: QuoteItem, quantity: string) => {
    const next = Number(quantity);
    if (!quote || !Number.isFinite(next) || next <= 0) return;
    await updateQuoteItem(item.id, { quantity: next }, 0);
    await refreshQuote(quote.id);
  };

  const removeItem = async (item: QuoteItem) => {
    if (!quote) return;
    await removeQuoteItem(item.id, 0);
    await refreshQuote(quote.id);
  };

  const saveCurrentQuote = async () => {
    if (!quote) return;
    await saveInfo();
    await saveQuote(quote.id);
    await refreshQuote(quote.id);
    setMessage("Quote saved.");
  };

  const clearQuote = async () => {
    setInfo(blankInfo);
    const next = await createQuote();
    setQuote(next);
    setMessage("Started a new blank quote.");
  };

  const printQuote = async () => {
    await saveInfo();
    window.setTimeout(() => window.print(), 0);
  };

  const convertQuote = async () => {
    if (!quote) return;
    await saveInfo();
    localStorage.setItem("flynns_quote_conversion", JSON.stringify({ quoteId: quote.id, quoteNumber: quote.quote_number, items: quote.items, info }));
    setMessage("Quote saved for conversion. Start Ticket will still require customer, vehicle, and mileage.");
    onConvertToTicket();
  };

  return (
    <>
      <section className="space-y-5 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--pos-text)]">Blank Order</h1>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">Build a quote or estimate without starting a full service ticket.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{quote?.quote_number ?? "New Quote"}</Badge>
            <Badge tone={quote?.status === "saved" ? "green" : "slate"}>{quote?.status ?? "draft"}</Badge>
          </div>
        </div>

        {message ? <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card className="p-5">
              <h2 className="text-xl font-black text-[var(--pos-text)]">Optional Customer / Vehicle Info</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Input label="Customer name" value={info.customer_name} onChange={(event) => setInfo({ ...info, customer_name: event.target.value })} />
                <Input label="Phone" value={info.customer_phone} onChange={(event) => setInfo({ ...info, customer_phone: event.target.value })} />
                <Input label="Email" value={info.customer_email} onChange={(event) => setInfo({ ...info, customer_email: event.target.value })} />
                <Input label="Year" value={info.vehicle_year} onChange={(event) => setInfo({ ...info, vehicle_year: event.target.value })} />
                <Input label="Make" value={info.vehicle_make} onChange={(event) => setInfo({ ...info, vehicle_make: event.target.value })} />
                <Input label="Model" value={info.vehicle_model} onChange={(event) => setInfo({ ...info, vehicle_model: event.target.value })} />
                <Input label="VIN" value={info.vehicle_vin} onChange={(event) => setInfo({ ...info, vehicle_vin: event.target.value.toUpperCase() })} />
                <Input label="Plate" value={info.vehicle_plate} onChange={(event) => setInfo({ ...info, vehicle_plate: event.target.value.toUpperCase() })} />
                <label className="text-sm font-semibold text-[var(--pos-text)]">Plate State
                  <select className="mt-2 h-12 w-full rounded-md border border-[var(--pos-border)] bg-white px-3 text-[var(--pos-text)]" value={info.vehicle_plate_state} onChange={(event) => setInfo({ ...info, vehicle_plate_state: event.target.value })}>
                    {US_STATES.map((state) => <option key={state.code} value={state.code}>{state.code} - {state.name}</option>)}
                  </select>
                </label>
                <Input label="Mileage" type="number" value={info.vehicle_mileage} onChange={(event) => setInfo({ ...info, vehicle_mileage: event.target.value })} />
              </div>
              <Input className="mt-4" label="Notes" value={info.notes} onChange={(event) => setInfo({ ...info, notes: event.target.value })} />
            </Card>

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[var(--pos-text)]">Quote Items</h2>
                  <p className="mt-1 text-sm text-[var(--pos-muted)]">Snapshot prices at quote time. No inventory is changed here.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["package", "inventory", "labor", "fee", "discount", "custom"] as AddMode[]).map((mode) => (
                    <Button key={mode} size="sm" variant={addMode === mode ? "primary" : "secondary"} onClick={() => setAddMode(mode)}>{mode === "package" ? "Add Package" : mode === "inventory" ? "Inventory Item" : mode[0].toUpperCase() + mode.slice(1)}</Button>
                  ))}
                </div>
              </div>

              {addMode === "package" ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="space-y-2">
                    {PACKAGE_CATEGORY_ORDER.map((category) => (
                      <button key={category} type="button" onClick={() => setPackageCategory(category)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${packageCategory === category ? "border-[var(--pos-blue)] bg-[var(--pos-blue-soft)] text-[var(--pos-blue)]" : "border-[var(--pos-border)] bg-white text-[var(--pos-text)]"}`}>{category}</button>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(groupedPackages[packageCategory as keyof typeof groupedPackages] ?? []).map((servicePackage) => (
                      <button key={servicePackage.id} type="button" onClick={() => addPackage(servicePackage)} className="rounded-2xl border border-[var(--pos-border)] bg-white p-4 text-left transition hover:border-[var(--pos-blue)]">
                        <div className="font-black text-[var(--pos-text)]">{servicePackage.name}</div>
                        <div className="mt-1 text-sm text-[var(--pos-muted)]">{[servicePackage.oil_brand, servicePackage.oil_type].filter(Boolean).join(" · ") || servicePackage.description}</div>
                        <div className="mt-3 font-black text-[var(--pos-blue)]">{formatMoney(servicePackage.package_total ?? servicePackage.base_price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {addMode === "inventory" ? (
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 text-[var(--pos-muted)]" size={18} />
                    <Input className="pl-10" placeholder="Search inventory by SKU, barcode, product, brand..." value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {inventory.map((item) => (
                      <button key={item.id} type="button" onClick={() => addInventory(item)} className="rounded-2xl border border-[var(--pos-border)] bg-white p-4 text-left transition hover:border-[var(--pos-blue)]">
                        <div className="font-black text-[var(--pos-text)]">{item.name}</div>
                        <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.sku ?? item.product_id ?? "No SKU"} · On hand {item.quantity_on_hand}</div>
                        <div className="mt-3 font-black text-[var(--pos-blue)]">{formatMoney(item.retail_price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {addMode !== "package" && addMode !== "inventory" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_120px_150px_auto] md:items-end">
                  <Input label="Name" value={quickLine.name} onChange={(event) => setQuickLine({ ...quickLine, name: event.target.value })} placeholder={addMode === "labor" ? "Labor" : addMode === "fee" ? "Shop Fee" : addMode === "discount" ? "Manager Discount" : "Custom Item"} />
                  <Input label="Description" value={quickLine.description} onChange={(event) => setQuickLine({ ...quickLine, description: event.target.value })} />
                  <Input label="Qty" type="number" value={quickLine.quantity} disabled={addMode === "discount"} onChange={(event) => setQuickLine({ ...quickLine, quantity: event.target.value })} />
                  <Input label={addMode === "discount" ? "Discount" : "Unit price"} type="number" value={quickLine.unit_price} onChange={(event) => setQuickLine({ ...quickLine, unit_price: event.target.value })} />
                  <Button icon={<PackagePlus size={16} />} disabled={!quickLine.name.trim() || !quickLine.unit_price.trim()} onClick={addQuickLine}>Add</Button>
                </div>
              ) : null}

              <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--pos-border)]">
                {quote?.items.length ? quote.items.map((item) => (
                  <div key={item.id} className="grid gap-3 border-b border-[var(--pos-border)] bg-white p-3 last:border-b-0 md:grid-cols-[1fr_120px_130px_110px_auto] md:items-center">
                    <div>
                      <div className="font-black text-[var(--pos-text)]">{item.name}</div>
                      <div className="text-sm text-[var(--pos-muted)]">{item.description || item.item_type}</div>
                    </div>
                    <Input type="number" value={String(item.quantity)} disabled={item.item_type === "discount"} onChange={(event) => void updateItemQuantity(item, event.target.value)} />
                    <div className="font-bold text-[var(--pos-text)]">{formatMoney(item.unit_price)}</div>
                    <div className="font-black text-[var(--pos-text)]">{formatMoney(itemLineTotal(item))}</div>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => void removeItem(item)}>Remove</Button>
                  </div>
                )) : <EmptyState title="No quote items" message="Add a package, inventory item, labor, fee, discount, or custom item." />}
              </div>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <Card className="p-5">
              <h2 className="text-xl font-black text-[var(--pos-text)]">Quote Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[var(--pos-muted)]">Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                <div className="flex justify-between"><span className="text-[var(--pos-muted)]">Discounts</span><strong>-{formatMoney(totals.discount_total)}</strong></div>
                <div className="flex justify-between"><span className="text-[var(--pos-muted)]">Tax Estimate</span><strong>{formatMoney(totals.tax_total)}</strong></div>
                <div className="flex justify-between border-t border-[var(--pos-border)] pt-3 text-lg"><span className="font-black">Total Estimate</span><strong>{formatMoney(totals.total)}</strong></div>
              </div>
              <div className="mt-5 grid gap-2">
                <Button icon={<Save size={16} />} onClick={() => void saveCurrentQuote()}>Save Quote</Button>
                <Button variant="secondary" icon={<Printer size={16} />} onClick={() => void printQuote()}>Print Quote</Button>
                <Button variant="secondary" icon={<Send size={16} />} disabled={!quote?.items.length} onClick={() => void convertQuote()}>Convert to Ticket</Button>
                <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => void clearQuote()}>Clear Quote</Button>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-black text-[var(--pos-blue)]"><FileText size={16} /> Estimate disclaimer</div>
              <p className="mt-2 text-sm leading-6 text-[var(--pos-muted)]">This is an estimate. Final pricing may change after vehicle inspection. No payment is collected from a quote.</p>
            </Card>
          </aside>
        </div>
      </section>
      <QuotePrintView quote={quote} />
    </>
  );
}
