import type { ReactNode } from "react";
import { BottomNav, Sidebar, type PageKey } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  activePage: PageKey;
  onNavigate: (page: PageKey, ticketId?: string) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen min-h-[100svh] overflow-hidden bg-[var(--pos-bg)] text-[var(--pos-text)]">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onNavigate={onNavigate} />
        <main className="flex-1 overflow-auto bg-transparent p-3 pb-24 sm:p-4 sm:pb-24 md:p-5 md:pb-24 lg:pb-6 xl:p-6">
          <div className="mx-auto w-full max-w-[1720px]">{children}</div>
        </main>
      </div>
      <BottomNav activePage={activePage} onNavigate={onNavigate} />
    </div>
  );
}
