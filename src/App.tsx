import { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import type { PageKey } from "./components/layout/Sidebar";
import { CustomerDetailsPage } from "./pages/CustomerDetailsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { InventoryPage } from "./pages/InventoryPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StartOrderPage } from "./pages/StartOrderPage";
import { OrderHistoryPage } from "./pages/OrderHistoryPage";
import { ActiveBaysPage } from "./pages/ActiveBaysPage";
import { BlankOrderPage } from "./pages/BlankOrderPage";
import { CheckInWallPage } from "./pages/CheckInWallPage";
import { WaitingPaymentPage } from "./pages/WaitingPaymentPage";
import { WorkOrdersPage } from "./pages/WorkOrdersPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { OrderWizardPage } from "./pages/order-wizard/OrderWizardPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { ToastProvider } from "./components/ui/Toast";
import { applyBrandConfig, getBrandConfig } from "./lib/branding/brandService";
import { brandChangedEvent } from "./lib/branding/brandStorage";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";
import type { TicketRouteState } from "./lib/domain/tickets/ticketNavigation";

type RouteState = TicketRouteState;
type Route = { page: PageKey; entityId?: string; state?: RouteState };

function pageFromPath(path: string): PageKey {
  if (path === "/active-bays") return "active-bays";
  if (path === "/check-in-wall") return "check-in-wall";
  if (path === "/work-orders") return "work-orders";
  if (path === "/blank-order") return "blank-order";
  if (path === "/payment-manager") return "payments";
  if (path === "/waiting-payment") return "waiting-payment";
  if (path === "/dashboard") return "overview";
  if (path === "/orders") return "order-history";
  return "order-history";
}

function renderPage(route: Route, navigate: (page: PageKey, entityId?: string, state?: RouteState) => void) {
  const activePage = route.page;
  switch (activePage) {
    case "overview":
      return <OverviewPage onStartTicket={() => navigate("order-wizard")} onOpenBays={() => navigate("active-bays")} onOpenOrders={() => navigate("order-history")} onOpenInventory={() => navigate("inventory")} onOpenCheckInWall={() => navigate("check-in-wall")} onOpenWaitingPayment={() => navigate("waiting-payment")} onOpenWorkOrders={() => navigate("work-orders")} onOpenPaymentManager={() => navigate("payments")} onOpenBlankOrder={() => navigate("blank-order")} onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/waiting-payment", fromLabel: "Waiting Payment" })} />;
    case "start-order":
      return <StartOrderPage onNavigate={navigate} />;
    case "order-wizard":
      return <OrderWizardPage onCreated={(id) => navigate("ticket-detail", id)} onBackToStart={() => navigate("start-order")} />;
    case "order-history":
      return <OrderHistoryPage onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/orders", fromLabel: "Orders" })} />;
    case "work-orders":
      return <WorkOrdersPage onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/work-orders", fromLabel: "Work Orders" })} />;
    case "active-bays":
      return <ActiveBaysPage onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/active-bays", fromLabel: "Active Bays" })} onOpenCheckInWall={() => navigate("check-in-wall")} onOpenWaitingPayment={() => navigate("waiting-payment")} />;
    case "check-in-wall":
      return <CheckInWallPage onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/check-in-wall", fromLabel: "Check-In Wall" })} />;
    case "waiting-payment":
      return <WaitingPaymentPage onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/waiting-payment", fromLabel: "Waiting Payment" })} />;
    case "blank-order":
      return <BlankOrderPage onConvertToTicket={() => navigate("order-wizard")} />;
    case "service-ticket":
      return <TicketsPage onOpenTicket={(id) => navigate("ticket-detail", id)} />;
    case "payments":
      return <PaymentsPage onOpenTicket={(id) => navigate("ticket-detail", id, { from: "/payment-manager", fromLabel: "Payment Manager" })} />;
    case "new-ticket":
      return <NewTicketPage onCreated={(id) => navigate("ticket-detail", id)} />;
    case "dashboard":
      return <DashboardPage />;
    case "tickets":
      return <TicketsPage onOpenTicket={(id) => navigate("ticket-detail", id)} />;
    case "ticket-detail":
      return <TicketDetailPage ticketId={route.entityId} routeState={route.state} onBack={(destination) => navigate(pageFromPath(destination.path))} onStartTicket={() => navigate("order-wizard")} onOpenCustomer={(id) => navigate("customers", id)} onOpenVehicle={(id) => navigate("vehicles", id)} />;
    case "customers":
      return <CustomersPage initialCustomerId={route.entityId} onStartTicket={() => navigate("order-wizard")} />;
    case "vehicles":
      return <VehiclesPage initialVehicleId={route.entityId} onStartTicket={() => navigate("order-wizard")} />;
    case "inventory":
      return <InventoryPage />;
    case "employees":
      return <EmployeesPage />;
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
  const navigate = (page: PageKey, entityId?: string, state?: RouteState) => setRoute({ page, entityId, state });

  useEffect(() => {
    const loadBrand = () => getBrandConfig().then(applyBrandConfig).catch(() => undefined);
    loadBrand();
    window.addEventListener(brandChangedEvent, loadBrand);
    return () => window.removeEventListener(brandChangedEvent, loadBrand);
  }, []);

  return (
    <ToastProvider>
      <AppShell activePage={route.page === "ticket-detail" ? pageFromPath(route.state?.from ?? "/orders") : route.page} onNavigate={navigate}>
        <AppErrorBoundary resetKey={`${route.page}:${route.entityId ?? ""}`} onReturnDashboard={() => navigate("overview")}>
          {renderPage(route, navigate)}
        </AppErrorBoundary>
      </AppShell>
    </ToastProvider>
  );
}
