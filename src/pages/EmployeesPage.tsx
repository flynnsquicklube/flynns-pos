import { Clock3, Coffee, LogIn, LogOut, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useToast } from "../components/ui/useToast";
import { listEmployees, type Employee } from "../lib/db/repositories/employeesRepo";
import {
  clockIn,
  clockOut,
  endBreak,
  getCurrentEmployeeStatus,
  listClockedInEmployees,
  listTimeEntries,
  startBreak,
  type EmployeeTimeEntry,
  type TimeClockSession
} from "../lib/db/repositories/timeClockRepo";
import { getCurrentEmployee } from "../lib/security/currentUser";
import { hasPermission } from "../lib/security/permissions";

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [currentStatus, setCurrentStatus] = useState<TimeClockSession | null>(null);
  const [activeSessions, setActiveSessions] = useState<TimeClockSession[]>([]);
  const [entries, setEntries] = useState<EmployeeTimeEntry[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [pin, setPin] = useState("");
  const { notify } = useToast();

  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === selectedEmployeeId) ?? null, [employees, selectedEmployeeId]);

  const reload = useCallback(async () => {
    const [employeeRows, activeRows, entryRows, currentEmployee] = await Promise.all([
      listEmployees(),
      listClockedInEmployees(),
      listTimeEntries(),
      getCurrentEmployee().catch(() => null)
    ]);
    setEmployees(employeeRows);
    setActiveSessions(activeRows);
    setEntries(entryRows.slice(0, 40));
    if (!selectedEmployeeId && employeeRows[0]) setSelectedEmployeeId(employeeRows[0].id);
    setCanManage(currentEmployee ? hasPermission(currentEmployee.role, "employee.manage") : true);
  }, [selectedEmployeeId]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setCurrentStatus(null);
      return;
    }
    void getCurrentEmployeeStatus(selectedEmployeeId).then(setCurrentStatus).catch(() => setCurrentStatus(null));
  }, [selectedEmployeeId]);

  const runAction = async (action: "clock_in" | "break_start" | "break_end" | "clock_out") => {
    if (!selectedEmployeeId) return;
    try {
      if (action === "clock_in") await clockIn(selectedEmployeeId);
      if (action === "break_start") await startBreak(selectedEmployeeId);
      if (action === "break_end") await endBreak(selectedEmployeeId);
      if (action === "clock_out") await clockOut(selectedEmployeeId);
      notify({ tone: "success", title: "Time clock updated", message: selectedEmployee?.display_name ?? "Employee" });
      setPin("");
      await reload();
      setCurrentStatus(await getCurrentEmployeeStatus(selectedEmployeeId));
    } catch (error) {
      notify({ tone: "error", title: "Time clock failed", message: error instanceof Error ? error.message : "Unable to update time clock." });
    }
  };

  const status = currentStatus?.status ?? "clocked_out";
  const statusTone = status === "clocked_in" ? "green" : status === "on_break" ? "yellow" : "slate";

  return (
    <section className="space-y-5">
      <PageHeader title="Employees" subtitle="Clock in, manage shop coverage, and review local time entries." />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-[var(--pos-text)]">Employee Time Clock</h2>
              <p className="mt-1 text-sm text-[var(--pos-muted)]">PIN verification can be enforced from Staff settings later. This local beta keeps the flow fast and visible.</p>
            </div>
            <Badge tone={statusTone}>{status.replace("_", " ")}</Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px]">
            <label className="text-sm font-semibold text-[var(--pos-text)]">
              Employee
              <select className="mt-2 h-14 w-full rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-panel)] px-4 text-lg font-bold text-[var(--pos-text)]" value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.display_name} · {employee.role}</option>)}
              </select>
            </label>
            <div className="rounded-[var(--pos-radius-lg)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--pos-muted)]">Current status</div>
              <div className="mt-2 text-2xl font-black text-[var(--pos-text)]">{status.replace("_", " ")}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-[var(--pos-radius-xl)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Employee PIN</div>
              <div className="mt-3 flex min-h-14 items-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-4 text-2xl font-black tracking-[0.35em] text-[var(--pos-text)]">
                {pin ? "•".repeat(pin.length) : <span className="tracking-normal text-[var(--pos-muted)]">Enter PIN</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" onClick={() => setPin((value) => `${value}${digit}`.slice(0, 8))} className="min-h-[58px] rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-xl font-black text-[var(--pos-text)]">
                    {digit}
                  </button>
                ))}
                <button type="button" onClick={() => setPin("")} className="min-h-[58px] rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-sm font-black text-[var(--pos-muted)]">Clear</button>
                <button type="button" onClick={() => setPin((value) => `${value}0`.slice(0, 8))} className="min-h-[58px] rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-xl font-black text-[var(--pos-text)]">0</button>
                <button type="button" onClick={() => setPin((value) => value.slice(0, -1))} className="min-h-[58px] rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-card)] text-sm font-black text-[var(--pos-muted)]">Back</button>
              </div>
            </div>
            <div className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Button size="touch" icon={<LogIn size={18} />} disabled={status === "clocked_in" || status === "on_break"} onClick={() => runAction("clock_in")}>Clock In</Button>
            <Button size="touch" variant="warning" icon={<Coffee size={18} />} disabled={status !== "clocked_in"} onClick={() => runAction("break_start")}>Start Break</Button>
            <Button size="touch" variant="secondary" icon={<Clock3 size={18} />} disabled={status !== "on_break"} onClick={() => runAction("break_end")}>End Break</Button>
            <Button size="touch" variant="danger" icon={<LogOut size={18} />} disabled={status === "clocked_out"} onClick={() => runAction("clock_out")}>Clock Out</Button>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-[var(--pos-text)]">Clocked In</h2>
            <Users className="text-[var(--pos-blue)]" size={22} />
          </div>
          <div className="mt-4 space-y-3">
            {activeSessions.length ? activeSessions.map((session) => (
              <div key={session.id} className="rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-3">
                <div className="font-black text-[var(--pos-text)]">{session.employee_name}</div>
                <div className="mt-1 text-sm text-[var(--pos-muted)]">{session.status.replace("_", " ")} since {session.clocked_in_at ? new Date(session.clocked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "--"}</div>
              </div>
            )) : <p className="text-sm text-[var(--pos-muted)]">No one is clocked in yet.</p>}
          </div>
        </Card>
      </div>
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[var(--pos-text)]">Recent Time Entries</h2>
            <p className="mt-1 text-sm text-[var(--pos-muted)]">{canManage ? "Owner/manager view. Hourly wage estimates stay out of employee workflow." : "Recent entries are view-only."}</p>
          </div>
          {!canManage ? <Badge tone="slate">Manager Only Editing</Badge> : null}
        </div>
        <div className="mt-4 divide-y divide-[var(--pos-border)]">
          {entries.map((entry) => (
            <div key={entry.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_150px_190px]">
              <div className="font-bold text-[var(--pos-text)]">{entry.employee_name}</div>
              <Badge tone={entry.entry_type.includes("break") ? "yellow" : entry.entry_type === "clock_in" ? "green" : "slate"}>{entry.entry_type.replace("_", " ")}</Badge>
              <div className="text-[var(--pos-muted)]">{new Date(entry.timestamp).toLocaleString()}</div>
            </div>
          ))}
          {!entries.length ? <p className="py-4 text-sm text-[var(--pos-muted)]">No time entries yet.</p> : null}
        </div>
      </Card>
    </section>
  );
}
