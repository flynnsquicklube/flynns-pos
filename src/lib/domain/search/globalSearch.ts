import { normalizePhone } from "../../utils/phone";

export function looksLikeVin(value: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value.trim());
}

export function shouldRunGlobalSearch(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 || looksLikeVin(trimmed) || normalizePhone(trimmed).length >= 2;
}

export function normalizeGlobalSearchQuery(value: string): string {
  return value.trim();
}

