import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { PageKey } from "./components/layout/Sidebar";
import { CustomerDetailsPage } from "./pages/CustomerDetailsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StartOrderPage } from "./pages/StartOrderPage";
import { OrderHistoryPage } from "./pages/OrderHistoryPage";
import { ActiveBaysPage } from "./pages/ActiveBaysPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { OrderWizardPage } from "./pages/order-wizard/OrderWizardPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { ToastProvider } from "./components/ui/Toast";

type Route = { page: PageKey; ticketId?: string };

function renderPage(route: Route, navigate: (page: PageKey, ticketId?: string) => void) {
  const activePage = route.page;
  switch (activePage) {
    case "overview":
      return <OverviewPage />;
    case "start-order":
      return <StartOrderPage onNavigate={navigate} />;
    case "order-wizard":
      return <OrderWizardPage onCreated={(id) => navigate("ticket-detail", id)} />;
    case "order-history":
      return <OrderHistoryPage onOpenTicket={(id) => navigate("ticket-detail", id)} />;
    case "active-bays":
      return <ActiveBaysPage onOpenTicket={(id) => navigate("ticket-detail", id)} />;
    case "service-ticket":
      return <TicketsPage onOpenTicket={(id) => navigate("ticket-detail", id)} />;
    case "payments":
      return <PaymentsPage />;
    case "new-ticket":
      return <NewTicketPage onCreated={(id) => navigate("ticket-detail", id)} />;
    case "dashboard":
      return <DashboardPage />;
    case "tickets":
      return <TicketsPage onOpenTicket={(id) => navigate("ticket-detail", id)} />;
    case "ticket-detail":
      return <TicketDetailPage ticketId={route.ticketId} onBack={() => navigate("order-history")} />;
    case "customers":
      return <CustomersPage />;
    case "vehicles":
      return <VehiclesPage />;
    case "inventory":
      return <InventoryPage />;
    case "reports":
      return <ReportsPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <CustomerDetailsPage />;
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>({ page: "overview" });
  const navigate = (page: PageKey, ticketId?: string) => setRoute({ page, ticketId });

  return (
    <ToastProvider>
      <AppShell activePage={route.page === "ticket-detail" || route.page === "order-wizard" ? (route.page === "order-wizard" ? "start-order" : "order-history") : route.page} onNavigate={(page) => navigate(page)}>
        {renderPage(route, navigate)}
      </AppShell>
    </ToastProvider>
  );
}
