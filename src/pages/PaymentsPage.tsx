import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { listPayments, type PaymentWithTicket } from "../lib/db/repositories/paymentsRepo";
import { formatMoney } from "../lib/utils/money";

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithTicket[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPayments().then(setPayments).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load payments."));
  }, []);

  const grouped = useMemo(() => {
    const filtered = payments.filter((payment) => `${payment.customer_first_name ?? ""} ${payment.customer_last_name ?? ""} ${payment.method}`.toLowerCase().includes(search.toLowerCase()));
    return filtered.reduce<Record<string, PaymentWithTicket[]>>((groups, payment) => {
      const key = new Date(payment.created_at).toLocaleDateString();
      groups[key] = [...(groups[key] ?? []), payment];
      return groups;
    }, {});
  }, [payments, search]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Payments</h1>
        <p className="text-sm text-slate-500">Local payment records from completed tickets.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled>All Operations</Button>
        <Button variant="secondary" disabled>Dates Coming Soon</Button>
        <Input className="max-w-sm" placeholder="Search payments" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button variant="secondary" disabled icon={<SlidersHorizontal size={16} />}>Filters Coming Soon</Button>
      </div>
      {error ? <Card className="p-4 text-sm text-red-700">{error}</Card> : null}
      {Object.keys(grouped).length === 0 ? (
        <Card className="p-4"><EmptyState title="No Payments Available" message="Completed tickets with local payment records will appear here." /></Card>
      ) : (
        Object.entries(grouped).map(([date, rows]) => (
          <Card key={date} className="overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 font-bold text-slate-950">{date}</div>
            <div className="divide-y divide-slate-100">
              {rows.map((payment) => (
                <div key={payment.id} className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-4 text-sm">
                  <div>
                    <div className="font-semibold text-slate-950">{payment.customer_first_name} {payment.customer_last_name}</div>
                    <div className="text-slate-500">{payment.method} - {payment.status}</div>
                  </div>
                  <div className="text-slate-500">{payment.ticket_id}</div>
                  <div className="font-bold text-slate-950">{formatMoney(payment.amount)}</div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </section>
  );
}
