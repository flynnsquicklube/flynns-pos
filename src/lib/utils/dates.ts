export function nowIso(): string {
  return new Date().toISOString();
}

export function formatShopDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
