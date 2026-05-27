import {
  BarChart3,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Columns3,
  CreditCard,
  FileText,
  Gauge,
  History,
  PlusCircle,
  PanelLeft,
  Settings,
  Users,
  Wifi
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "../branding/BrandLogo";
import { defaultBrand } from "../../lib/branding/defaultBrand";
import { getBrandConfig } from "../../lib/branding/brandService";
import { brandChangedEvent } from "../../lib/branding/brandStorage";
import { getElectronBridgeDebug } from "../../lib/db/sqlite";
import { getCurrentEmployee } from "../../lib/security/currentUser";
import { hasPermission } from "../../lib/security/permissions";

export type PageKey =
  | "overview"
  | "start-order"
  | "order-history"
  | "work-orders"
  | "check-in-wall"
  | "active-bays"
  | "waiting-payment"
  | "blank-order"
  | "service-ticket"
  | "payments"
  | "inventory"
  | "customers"
  | "employees"
  | "services"
  | "deals"
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
    label: "Shop",
    items: [
      { key: "overview", label: "Dashboard", icon: Gauge },
      { key: "order-wizard", label: "Start Ticket", icon: PlusCircle },
      { key: "work-orders", label: "Work Orders", icon: Columns3 },
      { key: "check-in-wall", label: "Check-In Wall", icon: ClipboardList },
      { key: "active-bays", label: "Active Bays", icon: PanelLeft }
    ]
  },
  {
    label: "Operations",
    items: [
      { key: "order-history", label: "Order Manager", icon: History },
      { key: "payments", label: "Payment Manager", icon: CreditCard },
      { key: "blank-order", label: "Blank Order", icon: FileText },
      { key: "inventory", label: "Inventory", icon: Boxes },
      { key: "customers", label: "Customers/Fleets", icon: Users }
    ]
  },
  {
    label: "Admin",
    items: [
      { key: "reports", label: "Admin/Reports", icon: BarChart3 },
      { key: "settings", label: "Settings", icon: Settings }
    ]
  }
] as const;

const mobileNavItems = [
  { key: "overview", label: "Home", icon: Gauge },
  { key: "order-wizard", label: "Start", icon: PlusCircle },
  { key: "work-orders", label: "Work", icon: Columns3 },
  { key: "check-in-wall", label: "Check-In", icon: ClipboardList },
  { key: "order-history", label: "Orders", icon: History },
  { key: "blank-order", label: "Quote", icon: FileText },
  { key: "active-bays", label: "Bays", icon: PanelLeft },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "settings", label: "Settings", icon: Settings }
] as const;

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const bridge = getElectronBridgeDebug();
  const [brand, setBrand] = useState(defaultBrand);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");
  const [canViewAdmin, setCanViewAdmin] = useState(true);
  useEffect(() => {
    const load = () => getBrandConfig().then(setBrand).catch(() => setBrand(defaultBrand));
    load();
    window.addEventListener(brandChangedEvent, load);
    return () => window.removeEventListener(brandChangedEvent, load);
  }, []);
  useEffect(() => {
    const loadEmployee = () => getCurrentEmployee().then((employee) => setCanViewAdmin(hasPermission(employee.role, "admin.analytics_view"))).catch(() => setCanViewAdmin(true));
    loadEmployee();
    window.addEventListener("flynns-current-employee-changed", loadEmployee);
    return () => window.removeEventListener("flynns-current-employee-changed", loadEmployee);
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      localStorage.setItem("sidebar_collapsed", String(!value));
      return !value;
    });
  }, []);
  useEffect(() => {
    window.addEventListener("flynns-toggle-sidebar", toggleCollapsed);
    return () => window.removeEventListener("flynns-toggle-sidebar", toggleCollapsed);
  }, [toggleCollapsed]);
  return (
    <aside className={`hidden shrink-0 flex-col bg-gradient-to-b from-[var(--pos-sidebar-light)] via-[var(--pos-sidebar)] to-[var(--pos-sidebar-dark)] py-4 text-white shadow-xl transition-[width] duration-200 lg:flex ${collapsed ? "w-[78px]" : "w-[78px] xl:w-[272px]"}`}>
      <button
        type="button"
        onClick={() => onNavigate("overview")}
        className={`mx-auto mb-5 flex items-center justify-center rounded-2xl bg-white/15 text-white shadow-sm ring-1 ring-white/20 ${collapsed ? "h-14 w-14 p-2" : "h-14 w-14 p-2 xl:mx-4 xl:h-28 xl:w-auto xl:flex-col xl:px-4 xl:py-3"}`}
        title={brand.businessName}
      >
        <BrandLogo brand={brand} size={collapsed ? "sm" : "sidebar"} className={collapsed ? "" : "xl:h-20"} />
        <span className={`mt-2 text-center text-sm font-black leading-tight ${collapsed ? "hidden" : "hidden xl:block"}`}>{brand.businessName}<br /><span className="text-xs font-semibold text-blue-100">{brand.appName}</span></span>
      </button>
      <nav className="flex flex-1 flex-col gap-4 px-3">
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-2 border-b border-white/10 pb-4 last:border-b-0" aria-label={section.label}>
            <div className={`px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/75 ${collapsed ? "hidden" : "hidden xl:block"}`}>{section.label}</div>
            {section.items.filter((item) => item.key !== "reports" || canViewAdmin).map((item) => {
              const Icon = item.icon;
              const active =
                activePage === item.key ||
                (activePage === "ticket-detail" && item.key === "order-history") ||
                ((activePage === "new-ticket" || activePage === "order-wizard") && item.key === "order-history");
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key as PageKey)}
                  className={`relative flex h-12 w-full items-center justify-center gap-3 rounded-2xl px-3 transition ${collapsed ? "" : "xl:justify-start"} ${
                    active ? "bg-white text-[var(--pos-sidebar)] shadow-md" : "text-blue-50 hover:bg-white/12 hover:text-white"
                  }`}
                  title={item.label}
                  aria-label={item.label}
                >
                  {active ? <span className="absolute left-0 h-7 w-1 rounded-r-full bg-white" /> : null}
                  <Icon size={22} />
                  <span className={`flex-1 text-left text-sm font-bold ${collapsed ? "hidden" : "hidden xl:block"}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`mx-3 mt-4 rounded-2xl border border-white/20 bg-white/12 p-3 ${collapsed ? "hidden" : "hidden xl:block"}`}>
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-100"><Wifi size={16} /> Shop is Open</div>
        <div className="mt-1 text-xs text-blue-100/80">{bridge.databaseAvailable ? "SQLite Connected" : "SQLite Bridge Missing"}</div>
      </div>
      <div className={`mx-3 mt-3 rounded-2xl border border-white/20 bg-white/10 p-3 ${collapsed ? "hidden" : "hidden xl:block"}`}>
        <div className="text-sm font-bold text-white">{brand.locationName || brand.businessName}</div>
        <div className="mt-1 text-xs text-blue-100/80">Local desktop register</div>
      </div>
      <button type="button" onClick={toggleCollapsed} className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-blue-50 transition hover:bg-white/20 hover:text-white" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
      <div className="mx-auto mt-3 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-blue-100" title="App version">v0.2</div>
    </aside>
  );
}

export function BottomNav({ activePage, onNavigate }: SidebarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--pos-border)] bg-white/95 px-2 py-2 shadow-[0_-12px_28px_rgba(14,27,51,.12)] backdrop-blur lg:hidden" aria-label="Primary navigation">
      <div className="mx-auto grid max-w-4xl grid-cols-4 gap-1 sm:grid-cols-8">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            activePage === item.key ||
            (activePage === "ticket-detail" && item.key === "order-history") ||
            ((activePage === "new-ticket" || activePage === "order-wizard") && item.key === "order-history");
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key as PageKey)}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-black transition ${
                active ? "bg-[var(--pos-blue)] text-white shadow-sm" : "text-[var(--pos-muted)] hover:bg-[var(--pos-blue-soft)] hover:text-[var(--pos-blue)]"
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={21} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
