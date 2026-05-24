export function normalizeVin(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizePlate(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

