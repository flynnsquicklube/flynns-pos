import { CarFront, ClipboardPlus, Search, Users } from "lucide-react";
import { Card } from "../components/ui/Card";
import type { PageKey } from "../components/layout/Sidebar";

interface StartOrderPageProps {
  onNavigate: (page: PageKey) => void;
}

const options = [
  { label: "Vehicle", subtitle: "Scan or search plate, VIN, or vehicle", icon: CarFront, page: "order-wizard" as PageKey },
  { label: "Customer / Fleet", subtitle: "Start from a customer record", icon: Users, page: "order-wizard" as PageKey },
  { label: "Year / Make / Model", subtitle: "Manual vehicle lookup workflow", icon: Search, page: "order-wizard" as PageKey },
  { label: "Other Vehicle", subtitle: "Create a manual vehicle ticket", icon: ClipboardPlus, page: "order-wizard" as PageKey }
];

export function StartOrderPage({ onNavigate }: StartOrderPageProps) {
  return (
    <section className="flex min-h-[calc(100vh-140px)] items-center justify-center">
      <Card className="w-full max-w-5xl p-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-950">Choose a Starting Point</h1>
          <p className="mt-2 text-sm text-slate-500">Start the order from the fastest piece of information in front of the advisor.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button key={option.label} onClick={() => onNavigate(option.page)} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:shadow-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-primary-light)] text-[var(--brand-primary)]">
                  <Icon size={34} />
                </div>
                <div className="mt-5 text-lg font-bold text-slate-950">{option.label}</div>
                <div className="mt-2 text-sm leading-5 text-slate-500">{option.subtitle}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
