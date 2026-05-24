import { Bell, ChevronDown, Sparkles } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { GlobalSearchBox } from "../search/GlobalSearchBox";
import type { PageKey } from "./Sidebar";

interface TopBarProps {
  onNavigate: (page: PageKey, entityId?: string) => void;
}

export function TopBar({ onNavigate }: TopBarProps) {
  return (
    <header className="relative z-20 flex min-h-[72px] items-center gap-4 border-b border-[var(--pos-border)] bg-[rgba(5,9,20,0.86)] px-5 backdrop-blur-xl">
      <GlobalSearchBox
        onCustomer={(id) => onNavigate("customers", id)}
        onVehicle={(id) => onNavigate("vehicles", id)}
        onTicket={(id) => onNavigate("ticket-detail", id)}
        onUseVin={() => onNavigate("order-wizard")}
      />
      <Button icon={<Sparkles size={18} />} onClick={() => onNavigate("order-wizard")}>Start Ticket</Button>
      <button type="button" disabled className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-[var(--pos-muted)]" title="Notifications Coming Soon">
        <Bell size={20} />
      </button>
      <div className="hidden items-center gap-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] px-3 py-2 md:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--pos-blue)] text-sm font-black text-white">BF</div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-[var(--pos-text)]">Brandon Flynn</div>
          <div className="text-xs text-[var(--pos-muted)]">Flynn's Quick Lube</div>
        </div>
        <ChevronDown size={16} className="text-[var(--pos-muted)]" />
      </div>
      <Badge tone="green" className="hidden xl:inline-flex">Local Online</Badge>
    </header>
  );
}

