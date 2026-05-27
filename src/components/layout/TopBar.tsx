import { CalendarDays, ChevronDown, Clock3, CloudOff, Menu, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { GlobalSearchBox } from "../search/GlobalSearchBox";
import { EmployeePinModal } from "../security/EmployeePinModal";
import type { PageKey } from "./Sidebar";
import { setStartTicketContext } from "../../lib/domain/startTicket/startTicketContext";
import { getCurrentEmployee, lockCurrentEmployee } from "../../lib/security/currentUser";
import type { Employee } from "../../lib/db/repositories/employeesRepo";

interface TopBarProps {
  onNavigate: (page: PageKey, entityId?: string) => void;
}

export function TopBar({ onNavigate }: TopBarProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [switching, setSwitching] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const load = () => getCurrentEmployee().then(setEmployee).catch(() => setEmployee(null));
    load();
    window.addEventListener("flynns-current-employee-changed", load);
    return () => window.removeEventListener("flynns-current-employee-changed", load);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const initials = employee?.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "BF";
  return (
    <header className="relative z-20 flex min-h-[76px] items-center gap-2 overflow-x-auto border-b border-[var(--pos-border)] bg-white/90 px-3 shadow-sm backdrop-blur-xl sm:gap-3 sm:px-4 md:gap-4 md:px-5">
      <button type="button" className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-blue)] lg:flex" title="Sidebar menu" onClick={() => window.dispatchEvent(new CustomEvent("flynns-toggle-sidebar"))}>
        <Menu size={20} />
      </button>
      <GlobalSearchBox
        onCustomer={(id) => onNavigate("customers", id)}
        onVehicle={(id) => onNavigate("vehicles", id)}
        onTicket={(id) => onNavigate("ticket-detail", id)}
        onStartCustomer={(id) => {
          setStartTicketContext({ customerId: id, source: "global_search" });
          onNavigate("order-wizard");
        }}
        onStartVehicle={(id) => {
          setStartTicketContext({ vehicleId: id, source: "global_search" });
          onNavigate("order-wizard");
        }}
        onStartTicketVehicle={(vehicleId, customerId) => {
          setStartTicketContext({ vehicleId, customerId: customerId ?? undefined, source: "order_detail" });
          onNavigate("order-wizard");
        }}
        onUseVin={(vin) => {
          setStartTicketContext({ vin, source: "global_search" });
          onNavigate("order-wizard");
        }}
      />
      <Button className="shrink-0" icon={<Sparkles size={18} />} onClick={() => onNavigate("order-wizard")}><span className="hidden sm:inline">New Ticket</span><span className="sm:hidden">New</span></Button>
      <div className="hidden h-12 items-center gap-2 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 text-sm font-bold text-[var(--pos-text)] lg:flex">
        <CalendarDays size={17} className="text-[var(--pos-blue)]" />
        {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
      <div className="hidden h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 lg:flex">
        <Clock3 size={17} />
        Open
      </div>
      <button type="button" onClick={() => setSwitching(true)} className="hidden items-center gap-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 py-2 text-left md:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--pos-blue)] text-sm font-black text-white">{initials}</div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-[var(--pos-text)]">{employee?.display_name ?? "Brandon Flynn"}</div>
          <div className="text-xs text-[var(--pos-muted)]">{employee?.role ?? "owner"}</div>
        </div>
        <ChevronDown size={16} className="text-[var(--pos-muted)]" />
      </button>
      <Button className="hidden shrink-0 sm:inline-flex" variant="ghost" size="sm" onClick={() => { lockCurrentEmployee(); setSwitching(true); }}>Lock</Button>
      <Badge tone="green" className="hidden xl:inline-flex"><CloudOff size={13} /> Local SQLite</Badge>
      {switching ? <EmployeePinModal onClose={() => setSwitching(false)} onSwitched={(next) => { setEmployee(next); setSwitching(false); }} /> : null}
    </header>
  );
}
