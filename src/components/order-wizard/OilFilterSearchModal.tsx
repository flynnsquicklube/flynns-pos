import { Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { formatMoney } from "../../lib/utils/money";
import type { InventoryItem } from "../../types/inventory";

interface OilFilterSearchModalProps {
  query: string;
  results: InventoryItem[];
  loading: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (item: InventoryItem) => void;
  onAddAsLine: (item: InventoryItem) => void;
  onClose: () => void;
}

export function OilFilterSearchModal({ query, results, loading, onQueryChange, onSelect, onAddAsLine, onClose }: OilFilterSearchModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-[var(--pos-border-strong)] bg-[var(--pos-panel)] shadow-2xl">
        <div className="border-b border-[var(--pos-border)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-[var(--pos-text)]">Search Oil Filters</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">Search by product ID, SKU, UPC, brand, supplier, or notes.</p>
            </div>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
          <div className="relative mt-5">
            <Search className="absolute left-4 top-4 text-[var(--pos-muted)]" size={20} />
            <Input inputSize="touch" className="pl-12" placeholder="Search OF, Service Champ, product ID..." value={query} onChange={(event) => onQueryChange(event.target.value)} />
          </div>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
          {loading ? <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-sm text-[var(--pos-muted)]">Searching filters...</div> : null}
          {!loading && results.length === 0 ? <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4 text-sm text-[var(--pos-muted)]">No oil filters found.</div> : null}
          {results.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-black text-[var(--pos-text)]">{item.product_id ?? item.sku ?? item.barcode ?? "No product ID"}</div>
                  <div className="mt-1 font-bold text-[var(--pos-text)]">{item.name}</div>
                  <div className="mt-1 text-sm text-[var(--pos-muted)]">{item.product_type ?? item.category} · {item.vendor ?? "No vendor"} · UPC {item.barcode ?? "-"}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-[var(--pos-text)]">{formatMoney(item.retail_price)}</div>
                  <div className="text-sm text-[var(--pos-muted)]">Cost {formatMoney(item.cost)} · Qty {item.quantity_on_hand}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => onSelect(item)}>Use This Filter</Button>
                <Button variant="secondary" onClick={() => onAddAsLine(item)}>Add as Charged Item</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
