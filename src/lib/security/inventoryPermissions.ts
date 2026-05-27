import { getCurrentEmployee } from "./currentUser";
import { hasPermission, type EmployeeRole, type Permission } from "./permissions";

export interface InventoryPermissionSet {
  role: EmployeeRole;
  canView: boolean;
  canEdit: boolean;
  canAdjust: boolean;
  canUseCountSheets: boolean;
  canUsePurchaseOrders: boolean;
  canManageSuppliers: boolean;
  canViewMetrics: boolean;
  canViewFinancials: boolean;
}

function allowed(role: EmployeeRole, permission: Permission) {
  return hasPermission(role, permission);
}

export async function getInventoryPermissionSet(): Promise<InventoryPermissionSet> {
  const employee = await getCurrentEmployee();
  const role = employee.role;
  return {
    role,
    canView: allowed(role, "inventory.view"),
    canEdit: allowed(role, "inventory.edit"),
    canAdjust: allowed(role, "inventory.adjust"),
    canUseCountSheets: allowed(role, "inventory.count_sheets"),
    canUsePurchaseOrders: allowed(role, "inventory.purchase_orders"),
    canManageSuppliers: allowed(role, "inventory.supplier_manage"),
    canViewMetrics: allowed(role, "inventory.metrics_view"),
    canViewFinancials: allowed(role, "inventory.financials_view")
  };
}
