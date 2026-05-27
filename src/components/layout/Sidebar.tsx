import { ChevronsLeft, ChevronsRight, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "../branding/BrandLogo";
import { defaultBrand } from "../../lib/branding/defaultBrand";
import { getBrandConfig } from "../../lib/branding/brandService";
import { brandChangedEvent } from "../../lib/branding/brandStorage";
import { getElectronBridgeDebug } from "../../lib/db/sqlite";
import { getCurrentEmployee } from "../../lib/security/currentUser";
import { hasPermission } from "../../lib/security/permissions";
import {
  IconActiveBays,
  IconBlankOrder,
  IconCheckInWall,
  IconCustomers,
  IconDashboard,
  IconEmployees,
  IconInventory,
  IconOrderManager,
  IconPaymentManager,
  IconReports,
  IconSettings,
  IconStartTicket,
  IconVehicles,
  IconWorkOrders
} from "../ui/PosNavIcons";
import { getModuleTheme } from "../../lib/config/moduleTheme";

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

type NavIcon = React.ComponentType<{ size?: number; className?: string }>;

const navSections: Array<{
  label: string;
  items: ReadonlyArray<{ key: string; label: string; icon: NavIcon }>;
}> = [
  {
    label: "Shop",
    items: [
      { key: "overview", label: "Dashboard", icon: IconDashboard },
      { key: "order-wizard", label: "Start Ticket", icon: IconStartTicket },
      { key: "work-orders", label: "Work Orders", icon: IconWorkOrders },
      { key: "check-in-wall", label: "Check-In Wall", icon: IconCheckInWall },
      { key: "active-bays", label: "Active Bays", icon: IconActiveBays }
    ]
  },
  {
    label: "Operations",
    items: [
      { key: "order-history", label: "Order Manager", icon: IconOrderManager },
      { key: "payments", label: "Payment Manager", icon: IconPaymentManager },
      { key: "blank-order", label: "Blank Order / Quote", icon: IconBlankOrder },
      { key: "inventory", label: "Inventory", icon: IconInventory },
      { key: "customers", label: "Customers / Fleets", icon: IconCustomers },
      { key: "vehicles", label: "Vehicles", icon: IconVehicles }
    ]
  },
  {
    label: "Admin",
    items: [
      { key: "employees", label: "Employees", icon: IconEmployees },
      { key: "reports", label: "Admin / Reports", icon: IconReports },
      { key: "settings", label: "Settings", icon: IconSettings }
    ]
  }
];

const mobileNavItems = [
  { key: "overview", label: "Home", icon: IconDashboard },
  { key: "order-wizard", label: "Start", icon: IconStartTicket },
  { key: "work-orders", label: "Work", icon: IconWorkOrders },
  { key: "check-in-wall", label: "Check-In", icon: IconCheckInWall },
  { key: "order-history", label: "Orders", icon: IconOrderManager },
  { key: "blank-order", label: "Quote", icon: IconBlankOrder },
  { key: "active-bays", label: "Bays", icon: IconActiveBays },
  { key: "inventory", label: "Inventory", icon: IconInventory },
  { key: "settings", label: "Settings", icon: IconSettings }
] as const;

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

function isActive(activePage: string, itemKey: string): boolean {
  if (activePage === itemKey) return true;
  if (activePage === "ticket-detail" && itemKey === "order-history") return true;
  if ((activePage === "new-ticket" || activePage === "order-wizard") && itemKey === "order-history") return true;
  return false;
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
    const loadEmployee = () =>
      getCurrentEmployee()
        .then((employee) => setCanViewAdmin(hasPermission(employee.role, "admin.analytics_view")))
        .catch(() => setCanViewAdmin(true));
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

  const expanded = !collapsed;

  return (
    <aside
      className={`hidden shrink-0 flex-col bg-gradient-to-b from-[var(--pos-sidebar-light)] via-[var(--pos-sidebar)] to-[var(--pos-sidebar-dark)] py-4 text-white shadow-xl transition-[width] duration-200 lg:flex ${
        collapsed ? "w-[74px]" : "w-[74px] xl:w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className={`mx-3 mb-5 ${expanded ? "xl:block" : ""}`}>
        <button
          type="button"
          onClick={() => onNavigate("overview")}
          title={brand.businessName}
          className={`flex items-center gap-3 rounded-2xl bg-white/6 ring-1 ring-white/10 transition hover:bg-white/10 p-3 ${
            collapsed ? "justify-center" : "justify-start"
          }`}
        >
          <div className="flex items-center justify-center rounded-lg bg-white/8 p-1" style={{ width: collapsed ? 40 : 44, height: collapsed ? 40 : 44 }}>
            <BrandLogo brand={brand} size={collapsed ? "sm" : "sidebar"} className={expanded ? "xl:h-16" : ""} />
          </div>
          {!collapsed ? (
            <div className="flex flex-col text-left leading-tight">
              <div className="text-sm font-black text-white">{brand.businessName}</div>
              <div className="text-[11px] font-semibold text-blue-100/80">{brand.appName}</div>
            </div>
          ) : null}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 pb-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-3">
            <div className={`mb-1.5 px-3 text-[9.5px] font-bold uppercase tracking-[0.2em] text-blue-200/60 ${collapsed ? "hidden" : "hidden xl:block"}`}>
              {section.label}
            </div>
            {section.items
              .filter((item) => item.key !== "reports" || canViewAdmin)
              .map((item) => {
                const Icon = item.icon;
                const active = isActive(activePage, item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.key as PageKey)}
                    title={item.label}
                    aria-label={item.label}
                    className={`relative mb-0.5 flex h-12 w-full items-center gap-3 rounded-xl px-2.5 transition ${
                      expanded ? "xl:justify-start" : "justify-center"
                    } justify-center ${
                      active
                        ? "bg-white/95 text-[var(--pos-sidebar)] shadow-sm"
                        : "text-blue-50/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full"
                        style={{ backgroundColor: getModuleTheme(item.key).accent }}
                      />
                    )}

                    {/* Icon chip */}
                    <span className={`shrink-0 flex items-center justify-center rounded-lg`}>
                      <span
                        className="flex items-center justify-center rounded-lg"
                        style={{
                          width: collapsed ? 40 : 44,
                          height: collapsed ? 40 : 44,
                          backgroundColor: active ? getModuleTheme(item.key).accent : getModuleTheme(item.key).muted,
                          color: active ? "#fff" : getModuleTheme(item.key).accent
                        }}
                      >
                        <Icon size={20} />
                      </span>
                    </span>

                    <span className={`flex-1 text-left text-[13px] font-bold ${collapsed ? "hidden" : "hidden xl:block"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            {/* Section divider */}
            <div className="mt-2 border-t border-white/10" />
          </div>
        ))}
      </nav>

      {/* Shop status */}
      <div className={`mx-2.5 mb-2 rounded-xl border border-white/15 bg-white/8 p-2.5 ${collapsed ? "hidden" : "hidden xl:block"}`}>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
          <Wifi size={13} /> Shop Open
        </div>
        <div className="mt-0.5 text-[10px] text-blue-200/70">
          {bridge.databaseAvailable ? "SQLite Connected" : "Bridge Missing"}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-blue-100/70 transition hover:bg-white/15 hover:text-white"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
      <div className="mx-auto mt-2 rounded px-2 py-0.5 text-[9px] font-bold text-blue-200/50">v0.2</div>
    </aside>
  );
}

export function BottomNav({ activePage, onNavigate }: SidebarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--pos-border)] bg-white/95 px-2 py-1.5 shadow-[0_-8px_24px_rgba(14,27,51,0.10)] backdrop-blur lg:hidden"
      aria-label="Primary navigation"
    >
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
              aria-label={item.label}
              title={item.label}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black transition ${
                active
                  ? "bg-[var(--pos-blue)] text-white"
                  : "text-[var(--pos-muted)] hover:bg-[var(--pos-blue-soft)] hover:text-[var(--pos-blue)]"
              }`}
            >
              <Icon size={20} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
