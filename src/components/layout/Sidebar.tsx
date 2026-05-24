import {
  BarChart3,
  Boxes,
  CarFront,
  Gauge,
  History,
  PanelLeft,
  Settings,
  Sparkles,
  Users,
  Wrench,
  Wifi
} from "lucide-react";
import { Badge } from "../ui/Badge";

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
      { key: "overview", label: "Dashboard", icon: Gauge },
      { key: "start-order", label: "Start Ticket", icon: Sparkles },
      { key: "active-bays", label: "Active Bays", icon: PanelLeft },
      { key: "order-history", label: "Orders", icon: History }
    ]
  },
  {
    label: "Records",
    items: [
      { key: "customers", label: "Customers", icon: Users },
      { key: "vehicles", label: "Vehicles", icon: CarFront },
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
    <aside className="flex w-[76px] shrink-0 flex-col bg-[var(--pos-panel)] py-4 text-white ring-1 ring-inset ring-[var(--pos-border)] xl:w-[260px]">
      <button
        type="button"
        onClick={() => onNavigate("overview")}
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pos-blue)] text-white shadow-sm pos-glow xl:mx-4 xl:w-auto xl:justify-start xl:px-4"
        title="Flynn's Quick Lube"
      >
        <Wrench size={24} />
        <span className="ml-3 hidden text-left text-sm font-black leading-tight xl:block">Flynn's<br /><span className="text-xs font-semibold text-sky-100">Quick Lube POS</span></span>
      </button>
      <nav className="flex flex-1 flex-col gap-4 px-3">
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-2 border-b border-white/10 pb-4 last:border-b-0" aria-label={section.label}>
            <div className="hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--pos-muted-2)] xl:block">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const disabled = Boolean("disabled" in item && item.disabled);
              const active =
                activePage === item.key ||
                (activePage === "ticket-detail" && item.key === "order-history") ||
                ((activePage === "new-ticket" || activePage === "order-wizard") && item.key === "start-order");
              return (
                <button
                  key={item.key}
                  onClick={() => !disabled && onNavigate(item.key as PageKey)}
                  disabled={disabled}
                  className={`relative flex h-12 w-full items-center justify-center gap-3 rounded-2xl px-3 transition xl:justify-start ${
                    active ? "bg-[var(--pos-blue)] text-white shadow-sm pos-glow" : "text-[var(--pos-muted)] hover:bg-[var(--pos-blue-soft)] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                  }`}
                  title={item.label}
                  aria-label={item.label}
                >
                  {active ? <span className="absolute left-0 h-7 w-1 rounded-r-full bg-white" /> : null}
                  <Icon size={22} />
                  <span className="hidden flex-1 text-left text-sm font-bold xl:block">{item.label}</span>
                  {disabled ? <Badge className="hidden xl:inline-flex">Soon</Badge> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mx-3 mt-4 hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] p-3 xl:block">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-200"><Wifi size={16} /> Online</div>
        <div className="mt-1 text-xs text-[var(--pos-muted)]">All systems operational</div>
      </div>
      <div className="mx-3 mt-3 hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] p-3 xl:block">
        <div className="text-sm font-bold text-[var(--pos-text)]">Flynn's Quick Lube</div>
        <div className="mt-1 text-xs text-[var(--pos-muted)]">Local desktop register</div>
      </div>
      <div className="mx-auto mt-3 rounded-md bg-[var(--pos-panel-2)] px-2 py-1 text-[10px] font-bold text-[var(--pos-muted)]" title="App version placeholder">
        v0.2
      </div>
    </aside>
  );
}
