import { CarFront, ClipboardPlus, Search, Users } from "lucide-react";
import { Card } from "../components/ui/Card";
import type { PageKey } from "../components/layout/Sidebar";
import { setStartTicketContext } from "../lib/domain/startTicket/startTicketContext";

interface StartOrderPageProps {
  onNavigate: (page: PageKey) => void;
}

const options = [
  { label: "Vehicle", subtitle: "Scan or search plate, VIN, or vehicle", icon: CarFront, page: "order-wizard" as PageKey, startingPoint: "vehicle" as const },
  { label: "Customer / Fleet", subtitle: "Start from a customer record", icon: Users, page: "order-wizard" as PageKey, startingPoint: "customer" as const },
  { label: "Year / Make / Model", subtitle: "Manual vehicle lookup workflow", icon: Search, page: "order-wizard" as PageKey, startingPoint: "manual" as const },
  { label: "Other Vehicle", subtitle: "Create a manual vehicle ticket", icon: ClipboardPlus, page: "order-wizard" as PageKey, startingPoint: "manual" as const }
];

export function StartOrderPage({ onNavigate }: StartOrderPageProps) {
  return (
    <section className="flex min-h-[calc(100vh-140px)] items-center justify-center">
      <Card className="w-full max-w-5xl p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--pos-blue)] text-white pos-glow">
            <ClipboardPlus size={34} />
          </div>
          <h1 className="text-3xl font-black text-[var(--pos-text)]">Choose a Starting Point</h1>
          <p className="mt-2 text-sm text-[var(--pos-muted)]">Start the order from the fastest piece of information in front of the advisor.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button key={option.label} onClick={() => { setStartTicketContext({ startingPoint: option.startingPoint, source: "global_search" }); onNavigate(option.page); }} className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pos-blue)] hover:bg-[var(--pos-card-hover)] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pos-blue-soft)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--pos-blue-soft)] text-[var(--pos-blue-2)]">
                  <Icon size={34} />
                </div>
                <div className="mt-5 text-lg font-black text-[var(--pos-text)]">{option.label}</div>
                <div className="mt-2 text-sm leading-5 text-[var(--pos-muted)]">{option.subtitle}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
