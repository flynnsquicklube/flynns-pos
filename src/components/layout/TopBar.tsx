import { CircleHelp, Settings, WifiOff } from "lucide-react";
import { Badge } from "../ui/Badge";

export function TopBar() {
  return (
    <header className="flex h-[58px] items-center justify-between border-b border-[var(--brand-border)] bg-white px-5">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Brandon Flynn</div>
          <div className="text-xs text-slate-500">Flynn's Quick Lube POS</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-900">Active Operation: <span className="text-[var(--brand-primary)]">Flynn's Quick Lube</span></div>
          <div className="text-xs text-slate-500">1023 Harrison Avenue</div>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Badge tone="blue" className="mr-2 hidden md:inline-flex">Local / Offline</Badge>
          <button type="button" className="rounded-lg p-2 hover:bg-[var(--brand-primary-light)] hover:text-[var(--brand-primary)]" title="Offline local mode">
            <WifiOff size={18} />
          </button>
          <button type="button" className="rounded-lg p-2 hover:bg-[var(--brand-primary-light)] hover:text-[var(--brand-primary)]" title="Help">
            <CircleHelp size={18} />
          </button>
          <button type="button" className="rounded-lg p-2 hover:bg-[var(--brand-primary-light)] hover:text-[var(--brand-primary)]" title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
