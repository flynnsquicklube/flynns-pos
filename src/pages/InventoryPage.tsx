import { Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import {
  countInventorySearchResults,
  createInventoryItem,
  getInventoryStats,
  listRecentlyActiveInventory,
  searchInventoryAdvanced,
  updateInventoryItem,
  type InventorySearchFilters,
  type InventoryStats
} from "../lib/db/repositories/inventoryRepo";
import { useToast } from "../components/ui/useToast";
import { formatMoney } from "../lib/utils/money";
import type { InventoryItem } from "../types/inventory";

const tabs = ["Inventory", "Add Products", "Count Sheets", "Metrics", "Scanner", "Suppliers", "Purchase Orders"];

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ sku: "", name: "", category: "", vendor: "", quantity: "0", cost: "0", retail: "0", reorder: "0" });
  const [activeFilter, setActiveFilter] = useState<keyof InventorySearchFilters | null>(null);
  const [stats, setStats] = useState<InventoryStats>({ totalItems: 0, importedItems: 0, lowStockItems: 0, oilFilters: 0, engineOils: 0 });
  const [resultCount, setResultCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const filtersFor = useCallback((filter: keyof InventorySearchFilters | null): InventorySearchFilters => filter ? { [filter]: true } : {}, []);

  const loadItems = useCallback((nextOffset = 0, append = false) => {
    setLoading(true);
    const query = debouncedSearch.trim();
    const hasSearchOrFilter = Boolean(query || activeFilter);
    const filters = filtersFor(activeFilter);
    const listPromise = hasSearchOrFilter ? searchInventoryAdvanced(query, filters, 50, nextOffset) : listRecentlyActiveInventory(25);
    const countPromise = hasSearchOrFilter ? countInventorySearchResults(query, filters) : Promise.resolve(25);
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

  useEffect(() => {
    void getInventoryStats().then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadItems(0, false);
  }, [debouncedSearch, activeFilter, loadItems]);

  const addInventory = async () => {
    if (!newItem.name.trim() || !newItem.category.trim()) {
      notify({ tone: "error", title: "Inventory details needed", message: "Name and category are required." });
      return;
    }
    await createInventoryItem({
      sku: newItem.sku.trim() || null,
      name: newItem.name.trim(),
      category: newItem.category.trim(),
      vendor: newItem.vendor.trim() || null,
      cost: Number(newItem.cost) || 0,
      retail_price: Number(newItem.retail) || 0,
      quantity_on_hand: Number(newItem.quantity) || 0,
      reorder_point: Number(newItem.reorder) || 0,
      barcode: null,
      active: 1,
      notes: null
    });
    notify({ tone: "success", title: "Inventory item saved" });
    setShowAdd(false);
    setNewItem({ sku: "", name: "", category: "", vendor: "", quantity: "0", cost: "0", retail: "0", reorder: "0" });
    void getInventoryStats().then(setStats).catch(() => undefined);
    loadItems();
  };

  const adjustQuantity = async (item: InventoryItem, quantity: number) => {
    await updateInventoryItem(item.id, { quantity_on_hand: quantity });
    notify({ tone: "success", title: "Quantity updated", message: item.name });
    void getInventoryStats().then(setStats).catch(() => undefined);
    loadItems();
  };

  const hasSearchOrFilter = Boolean(debouncedSearch.trim() || activeFilter);
  const filterButtons: { key: keyof InventorySearchFilters; label: string }[] = [
    { key: "lowStock", label: "Low Stock" },
    { key: "oilFilters", label: "Oil Filters" },
    { key: "engineOil", label: "Engine Oil" },
    { key: "airFilters", label: "Air Filters" },
    { key: "cabinFilters", label: "Cabin Filters" },
    { key: "wipers", label: "Wipers" },
    { key: "imported", label: "Imported" }
  ];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Inventory</h1>
        <p className="text-sm text-slate-500">Manage filters, oils, parts, and shop supplies.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map((tab, index) => (
          <button key={tab} disabled={index !== 0} className={`px-3 py-3 text-sm font-semibold ${index === 0 ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-400"}`}>
            {index === 0 ? tab : `${tab} Coming Soon`}
          </button>
        ))}
      </div>
      <Card className="p-5">
        <div className="relative">
          <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={21} />
          <Input inputSize="touch" className="pl-12 text-lg" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product ID, oil filter, oil type, UPC, brand, supplier..." />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filterButtons.map((filter) => (
            <Button key={filter.key} variant={activeFilter === filter.key ? "primary" : "secondary"} icon={filter.key === "lowStock" ? <SlidersHorizontal size={16} /> : undefined} onClick={() => setActiveFilter((current) => current === filter.key ? null : filter.key)}>
              {filter.label}
            </Button>
          ))}
        </div>
      </Card>
      {!hasSearchOrFilter ? (
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="p-4"><div className="text-sm text-slate-500">Total Items</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.totalItems}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Imported</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.importedItems}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Low Stock</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.lowStockItems}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Oil Filters</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.oilFilters}</div></Card>
          <Card className="p-4"><div className="text-sm text-slate-500">Engine Oils</div><div className="mt-2 text-3xl font-black text-slate-950">{stats.engineOils}</div></Card>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Button size="touch" onClick={() => setShowAdd((value) => !value)}>{showAdd ? "Close" : "Add Inventory Item"}</Button>
      </div>
      {showAdd ? (
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input label="SKU" value={newItem.sku} onChange={(event) => setNewItem({ ...newItem, sku: event.target.value })} />
            <Input label="Name" value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} />
            <Input label="Category" value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })} />
            <Input label="Vendor" value={newItem.vendor} onChange={(event) => setNewItem({ ...newItem, vendor: event.target.value })} />
            <Input label="Qty" type="number" value={newItem.quantity} onChange={(event) => setNewItem({ ...newItem, quantity: event.target.value })} />
            <Input label="Cost" type="number" step="0.01" value={newItem.cost} onChange={(event) => setNewItem({ ...newItem, cost: event.target.value })} />
            <Input label="Retail" type="number" step="0.01" value={newItem.retail} onChange={(event) => setNewItem({ ...newItem, retail: event.target.value })} />
            <Input label="Reorder Point" type="number" value={newItem.reorder} onChange={(event) => setNewItem({ ...newItem, reorder: event.target.value })} />
          </div>
          <Button className="mt-4" onClick={addInventory}>Save Item</Button>
        </Card>
      ) : null}
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
          <span>{hasSearchOrFilter ? `${resultCount} matching item${resultCount === 1 ? "" : "s"}` : "Recently active inventory"}</span>
          {loading ? <span>Searching...</span> : null}
        </div>
        {items.length === 0 ? (
          <EmptyState title={loading ? "Loading inventory" : "No inventory items"} message={hasSearchOrFilter ? "Try another product ID, oil type, UPC, brand, or supplier." : "Recently active inventory records will appear here."} />
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[1280px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Product ID", "Product Type", "Brand", "Seq. ID", "Quantity On Hand", "PO Qty.", "Qty. Sold Last 30 Days", "Cost", "Retail", "Suppliers", "Last Active", "Internal Note"].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const lowStock = item.quantity_on_hand <= item.reorder_point;
                  return (
                    <tr key={item.id} className="bg-white hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-950">
                        <div>{item.product_id ?? item.sku ?? item.id}</div>
                        {item.is_imported ? <Badge tone="blue">Imported</Badge> : null}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="font-semibold">{item.product_type ?? item.name}</div>
                        <div className="text-xs text-slate-500">{[item.viscosity, item.oil_formulation].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.vendor ?? "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.sequence_id ?? String(index + 1).padStart(4, "0")}</td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input className="w-24" type="number" value={item.quantity_on_hand} onChange={(event) => void adjustQuantity(item, Number(event.target.value))} />
                          {lowStock ? <Badge tone="red">Low</Badge> : null}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">0</td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.quantity_sold_last_30_days ?? 0}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{formatMoney(item.cost)}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{formatMoney(item.retail_price)}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.vendor ?? "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{new Date(item.updated_at).toLocaleDateString()}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.notes ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {hasSearchOrFilter && items.length < resultCount ? (
          <div className="border-t border-slate-200 p-4 text-center">
            <Button variant="secondary" disabled={loading} onClick={() => loadItems(offset, true)}>Load More</Button>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
