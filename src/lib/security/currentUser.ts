import { getEmployeeById, getOrCreateDefaultEmployee, listActiveEmployees } from "../db/repositories/employeesRepo";
import type { Employee } from "../db/repositories/employeesRepo";

const sessionKey = "flynns.pos.currentEmployeeId";

export const defaultOwnerSession: Employee = {
  id: "emp_brandon_flynn",
  first_name: "Brandon",
  last_name: "Flynn",
  display_name: "Brandon Flynn",
  email: null,
  phone: null,
  role: "owner",
  pin_hash: null,
  active: 1,
  hourly_rate: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  sync_status: "synced"
};

export function getCurrentEmployeeSnapshot(): Employee {
  return defaultOwnerSession;
}

export async function getCurrentEmployee(): Promise<Employee> {
  const storedId = localStorage.getItem(sessionKey);
  if (storedId) {
    const employee = await getEmployeeById(storedId);
    if (employee?.active) return employee;
  }
  const fallback = await getOrCreateDefaultEmployee();
  localStorage.setItem(sessionKey, fallback.id);
  return fallback;
}

export async function setCurrentEmployee(employeeId: string): Promise<Employee> {
  const employee = await getEmployeeById(employeeId);
  if (!employee || !employee.active) throw new Error("Employee is inactive or missing.");
  localStorage.setItem(sessionKey, employee.id);
  window.dispatchEvent(new CustomEvent("flynns-current-employee-changed"));
  return employee;
}

export function lockCurrentEmployee(): void {
  localStorage.removeItem(sessionKey);
  window.dispatchEvent(new CustomEvent("flynns-current-employee-changed"));
}

export async function listSwitchableEmployees(): Promise<Employee[]> {
  return listActiveEmployees();
}
