import { formatMoney } from "../../lib/utils/money";
import type { TicketItem } from "../../types/ticket";
import { Button } from "../ui/Button";
import { PosCard } from "./PosCard";

export function PosTicketSummary({
  title = "Ticket Summary",
  ticketId,
  items,
  subtotal,
  tax,
  total,
  onSave,
  payEnabled = false
}: {
  title?: string;
  ticketId?: string | null;
  items: Pick<TicketItem, "id" | "name" | "quantity" | "line_total">[];
  subtotal: number;
  tax: number;
  total: number;
  onSave?: () => void;
  payEnabled?: boolean;
}) {
  return (
    <PosCard title={title} eyebrow={ticketId ? `Order ${ticketId}` : "Unsaved order"} className="sticky top-5">
      <div className="space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3 text-sm">
            <div>
              <div className="font-bold text-[var(--pos-text)]">{item.name}</div>
              <div className="text-xs text-[var(--pos-muted)]">Qty {item.quantity}</div>
            </div>
            <div className="font-black text-[var(--pos-text)]">{formatMoney(item.line_total)}</div>
          </div>
        )) : <div className="rounded-xl border border-dashed border-[var(--pos-border)] p-4 text-sm text-[var(--pos-muted)]">No items selected yet.</div>}
      </div>
      <div className="mt-5 space-y-2 border-t border-[var(--pos-border)] pt-4 text-sm">
        <div className="flex justify-between text-[var(--pos-muted)]"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
        <div className="flex justify-between text-[var(--pos-muted)]"><span>Tax</span><span>{formatMoney(tax)}</span></div>
        <div className="flex justify-between text-xl font-black text-[var(--pos-text)]"><span>Total</span><span>{formatMoney(total)}</span></div>
      </div>
      <div className="mt-5 grid gap-3">
        <Button onClick={onSave}>Save Ticket</Button>
        <Button variant={payEnabled ? "success" : "secondary"} disabled={!payEnabled}>{payEnabled ? "Pay" : "Pay Coming Soon"}</Button>
        <Button variant="ghost">More Options</Button>
      </div>
    </PosCard>
  );
}
