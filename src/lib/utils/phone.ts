export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function phoneSearchVariants(value: string): { raw: string; digits: string } {
  return { raw: value.trim(), digits: normalizePhone(value) };
}

