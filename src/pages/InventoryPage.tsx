import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { createInventoryItem, listInventoryItems, updateInventoryItem } from "../lib/db/repositories/inventoryRepo";
import { useToast } from "../components/ui/useToast";
import { formatMoney } from "../lib/utils/money";
import type { InventoryItem } from "../types/inventory";

const tabs = ["Inventory", "Add Products", "Count Sheets", "Metrics", "Scanner", "Suppliers", "Purchase Orders"];

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ sku: "", name: "", category: "", vendor: "", quantity: "0", cost: "0", retail: "0", reorder: "0" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const loadItems = () => {
    setLoading(true);
    listInventoryItems(search)
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load inventory."))
      .finally(() => setLoading(false));
  };

  useEffect(loadItems, [search]);

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
    loadItems();
  };

  const adjustQuantity = async (item: InventoryItem, quantity: number) => {
    await updateInventoryItem(item.id, { quantity_on_hand: quantity });
    notify({ tone: "success", title: "Quantity updated", message: item.name });
    loadItems();
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Inventory</h1>
        <p className="text-sm text-slate-500">Manage filters, oils, parts, and shop supplies.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map((tab, index) => (
          <button key={tab} className={`px-3 py-3 text-sm font-semibold ${index === 0 ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary-dark)]" : "text-slate-500 hover:text-slate-900"}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input className="max-w-md" label="Search inventory" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product ID / Type / Note" />
        <Button variant="secondary" size="touch" icon={<SlidersHorizontal size={16} />}>Filters</Button>
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
        {items.length === 0 ? (
          <EmptyState title={loading ? "Loading inventory" : "No inventory items"} message="Inventory records will appear here." />
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
                      <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-950">{item.sku ?? item.id}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.name}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{item.vendor ?? "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-3">{String(index + 1).padStart(4, "0")}</td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input className="w-24" type="number" value={item.quantity_on_hand} onChange={(event) => void adjustQuantity(item, Number(event.target.value))} />
                          {lowStock ? <Badge tone="red">Low</Badge> : null}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">0</td>
                      <td className="border-b border-slate-100 px-4 py-3">0</td>
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
      </Card>
    </section>
  );
}
