import type { ReactNode } from "react";
import { Sidebar, type PageKey } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  activePage: PageKey;
  onNavigate: (page: PageKey, ticketId?: string) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen min-h-[680px] bg-[var(--pos-bg)] text-[var(--pos-text)]">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onNavigate={onNavigate} />
        <main className="flex-1 overflow-auto bg-transparent p-5 xl:p-6">{children}</main>
      </div>
    </div>
  );
}
