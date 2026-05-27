import { useEffect, useState } from "react";
import { listSwitchableEmployees, setCurrentEmployee } from "../../lib/security/currentUser";
import { verifyEmployeePin, type Employee } from "../../lib/db/repositories/employeesRepo";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { TouchSelect } from "../ui/TouchSelect";

interface EmployeePinModalProps {
  onClose: () => void;
  onSwitched: (employee: Employee) => void;
}

export function EmployeePinModal({ onClose, onSwitched }: EmployeePinModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSwitchableEmployees().then((rows) => {
      setEmployees(rows);
      setEmployeeId(rows[0]?.id ?? "");
    }).catch(() => setEmployees([]));
  }, []);

  const switchEmployee = async () => {
    try {
      const verified = await verifyEmployeePin(employeeId, pin);
      const employee = await setCurrentEmployee(verified.id);
      onSwitched(employee);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to switch employee.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-[var(--pos-radius-xl)] border border-[var(--pos-border-strong)] bg-[var(--pos-panel)] p-5 shadow-2xl">
        <h2 className="text-xl font-black text-[var(--pos-text)]">Switch Employee</h2>
        <p className="mt-1 text-sm text-[var(--pos-muted)]">Select an employee and enter PIN if one is configured.</p>
        <div className="mt-4">
          <TouchSelect label="Employee" value={employeeId} onChange={setEmployeeId} options={employees.map((employee) => ({ value: employee.id, label: employee.display_name, description: employee.role }))} searchable />
        </div>
        <Input className="mt-3" label="PIN" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} />
        {error ? <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={switchEmployee}>Switch Employee</Button>
        </div>
      </div>
    </div>
  );
}
