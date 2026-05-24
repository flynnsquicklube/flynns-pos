import {
  BarChart3,
  Boxes,
  ChevronLeft,
  Gauge,
  History,
  PanelLeft,
  Settings,
  Sparkles,
  Users,
  Wrench
} from "lucide-react";

export type PageKey =
  | "overview"
  | "start-order"
  | "order-history"
  | "active-bays"
  | "service-ticket"
  | "payments"
  | "inventory"
  | "customers"
  | "reports"
  | "settings"
  | "dashboard"
  | "tickets"
  | "new-ticket"
  | "order-wizard"
  | "ticket-detail"
  | "vehicles";

const navSections = [
  {
    label: "Operations",
    items: [
      { key: "overview", label: "Overview", icon: Gauge },
      { key: "start-order", label: "Start Order", icon: Sparkles },
      { key: "active-bays", label: "Active Bays", icon: PanelLeft },
      { key: "order-history", label: "Order History", icon: History }
    ]
  },
  {
    label: "Records",
    items: [
      { key: "customers", label: "Customers", icon: Users },
      { key: "inventory", label: "Inventory", icon: Boxes },
      { key: "reports", label: "Reports", icon: BarChart3 }
    ]
  },
  {
    label: "Admin",
    items: [{ key: "settings", label: "Settings", icon: Settings }]
  }
] as const;

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-[76px] shrink-0 flex-col items-center bg-[var(--brand-sidebar)] py-3 text-white">
      <button
        type="button"
        onClick={() => onNavigate("overview")}
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white shadow-sm"
        title="Flynn's Quick Lube"
      >
        <Wrench size={24} />
      </button>
      <nav className="flex flex-1 flex-col items-center gap-3">
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col items-center gap-2 border-b border-white/10 pb-3 last:border-b-0" aria-label={section.label}>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                activePage === item.key ||
                (activePage === "ticket-detail" && item.key === "order-history") ||
                ((activePage === "new-ticket" || activePage === "order-wizard") && item.key === "start-order");
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-xl transition ${
                    active ? "bg-[var(--brand-primary)] text-white shadow-sm" : "text-zinc-200 hover:bg-[#2B638A]/40 hover:text-white"
                  }`}
                  title={item.label}
                  aria-label={item.label}
                >
                  {active ? <span className="absolute -left-2 h-7 w-1 rounded-full bg-white" /> : null}
                  <Icon size={22} />
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <button type="button" className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl text-zinc-200 hover:bg-[#2B638A]/40 hover:text-white" title="Collapse placeholder">
        <ChevronLeft size={21} />
      </button>
      <div className="mt-2 rounded-md bg-[#2E3238] px-2 py-1 text-[10px] font-bold text-zinc-200" title="App version placeholder">
        v0.2
      </div>
    </aside>
  );
}
