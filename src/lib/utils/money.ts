export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(value: number): number {
  return value / 100;
}
