import type { ReactNode } from "react";
import { Sidebar, type PageKey } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen min-h-[680px] bg-[var(--brand-bg)] text-[var(--brand-text)]">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto bg-[var(--brand-bg)] p-6">{children}</main>
      </div>
    </div>
  );
}
