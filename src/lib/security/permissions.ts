export type EmployeeRole = "owner" | "manager" | "technician" | "cashier";

export type Permission =
  | "inventory.view"
  | "ticket.start_service"
  | "ticket.move_bay"
  | "ticket.edit_items"
  | "ticket.cancel"
  | "ticket.finalize"
  | "payment.add"
  | "inventory.edit"
  | "inventory.adjust"
  | "inventory.count_sheets"
  | "inventory.purchase_orders"
  | "inventory.supplier_manage"
  | "inventory.metrics_view"
  | "inventory.financials_view"
  | "admin.analytics_view"
  | "settings.edit"
  | "package.edit"
  | "employee.manage"
  | "reports.view"
  | "database.reset"
  | "import.run";

const rolePermissions: Record<EmployeeRole, Permission[]> = {
  owner: ["inventory.view", "ticket.start_service", "ticket.move_bay", "ticket.edit_items", "ticket.cancel", "ticket.finalize", "payment.add", "inventory.edit", "inventory.adjust", "inventory.count_sheets", "inventory.purchase_orders", "inventory.supplier_manage", "inventory.metrics_view", "inventory.financials_view", "admin.analytics_view", "settings.edit", "package.edit", "employee.manage", "reports.view", "database.reset", "import.run"],
  manager: ["inventory.view", "ticket.start_service", "ticket.move_bay", "ticket.edit_items", "ticket.cancel", "ticket.finalize", "payment.add", "inventory.edit", "inventory.adjust", "inventory.count_sheets", "inventory.purchase_orders", "inventory.supplier_manage", "inventory.metrics_view", "inventory.financials_view", "admin.analytics_view", "settings.edit", "package.edit", "employee.manage", "reports.view", "import.run"],
  technician: ["inventory.view", "ticket.start_service", "ticket.move_bay", "ticket.edit_items", "payment.add", "inventory.adjust", "reports.view"],
  cashier: ["inventory.view", "ticket.finalize", "payment.add", "reports.view"]
};

export function hasPermission(role: EmployeeRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function managerApprovalRequiredMessage(): string {
  return "Manager approval required";
}
