export type ModuleKey =
  | "overview"
  | "order-wizard"
  | "order-history"
  | "work-orders"
  | "check-in-wall"
  | "active-bays"
  | "payments"
  | "blank-order"
  | "inventory"
  | "customers"
  | "vehicles"
  | "employees"
  | "reports"
  | "settings"
  | "start-ticket";

export interface ModuleTheme {
  accent: string; // primary accent color
  muted: string; // subtle background tint
}

const map: Record<ModuleKey, ModuleTheme> = {
  overview: { accent: "#0B7CFF", muted: "rgba(11,124,255,0.12)" }, // blue
  "start-ticket": { accent: "#0B7CFF", muted: "rgba(11,124,255,0.12)" },
  "order-wizard": { accent: "#0B7CFF", muted: "rgba(11,124,255,0.12)" },
  "work-orders": { accent: "#6366F1", muted: "rgba(99,102,241,0.10)" }, // indigo
  "check-in-wall": { accent: "#06B6D4", muted: "rgba(6,182,212,0.10)" }, // cyan
  "active-bays": { accent: "#2563EB", muted: "rgba(37,99,235,0.10)" }, // steel blue
  "order-history": { accent: "#334155", muted: "rgba(51,65,85,0.08)" }, // navy/slate
  payments: { accent: "#F59E0B", muted: "rgba(245,158,11,0.10)" }, // amber
  "blank-order": { accent: "#8B5CF6", muted: "rgba(139,92,246,0.10)" }, // purple
  inventory: { accent: "#10B981", muted: "rgba(16,185,129,0.10)" }, // emerald
  customers: { accent: "#0EA5E9", muted: "rgba(14,165,233,0.10)" }, // sky/cyan
  vehicles: { accent: "#64748B", muted: "rgba(100,116,139,0.08)" }, // blue-gray
  employees: { accent: "#F97316", muted: "rgba(249,115,22,0.10)" }, // orange
  reports: { accent: "#7C3AED", muted: "rgba(124,58,237,0.10)" }, // violet
  settings: { accent: "#475569", muted: "rgba(71,85,105,0.08)" }
};

export function getModuleTheme(key: ModuleKey | string): ModuleTheme {
  return (map as Record<string, ModuleTheme>)[key] ?? { accent: "#0B7CFF", muted: "rgba(11,124,255,0.08)" };
}

export default map;
