export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

