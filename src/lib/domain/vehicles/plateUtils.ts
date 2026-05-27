export function normalizePlate(input: string | null | undefined): string {
  return (input ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function normalizePlateState(input: string | null | undefined): string {
  const state = (input ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : state.slice(0, 2);
}

export function isValidPlate(input: string | null | undefined): boolean {
  return normalizePlate(input).length > 0;
}

export function formatPlateForDisplay(plate: string | null | undefined, state?: string | null): string {
  const normalizedPlate = normalizePlate(plate);
  const normalizedState = normalizePlateState(state);
  return [normalizedPlate, normalizedState].filter(Boolean).join(" ");
}

export function platesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizePlate(a) === normalizePlate(b);
}
