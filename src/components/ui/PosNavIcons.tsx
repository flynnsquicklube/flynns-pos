import {
  LayoutDashboard,
  PlusSquare,
  ClipboardList,
  Users,
  Truck,
  CreditCard,
  Box,
  FileText,
  BarChart2,
  Settings as LucideSettings,
  ListChecks
} from "lucide-react";

interface IconProps {
  size?: number;
  className?: string;
}

function wrap(IconComponent: any) {
  return function Wrapped({ size = 20, className = "" }: IconProps) {
    return <IconComponent size={size} strokeWidth={1.8} className={className} />;
  };
}

export const IconDashboard = wrap(LayoutDashboard);
export const IconStartTicket = wrap(PlusSquare);
export const IconWorkOrders = wrap(ClipboardList);
export const IconCheckInWall = wrap(ListChecks);
export const IconActiveBays = wrap(Truck);
export const IconOrderManager = wrap(FileText);
export const IconPaymentManager = wrap(CreditCard);
export const IconBlankOrder = wrap(FileText);
export const IconInventory = wrap(Box);
export const IconCustomers = wrap(Users);
export const IconVehicles = wrap(Truck);
export const IconEmployees = wrap(Users);
export const IconReports = wrap(BarChart2);
export const IconSettings = wrap(LucideSettings);

// Other icons kept as generic placeholders
export const IconOilChange = wrap(PlusSquare);
export const IconTimeClock = wrap(PlusSquare);
