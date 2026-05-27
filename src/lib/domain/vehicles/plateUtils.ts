import { US_STATES } from "./usStates";

const stateNameToCode = new Map<string, string>(US_STATES.map((state) => [state.name.toUpperCase(), state.code]));
const stateCodeToName = new Map<string, string>(US_STATES.map((state) => [state.code, state.name.toUpperCase()]));

export function normalizePlate(input: string | null | undefined): string {
  return (input ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizePlateState(input: string | null | undefined): string {
  const state = (input ?? "").trim().toUpperCase();
  if (!state) return "";
  if (/^[A-Z]{2}$/.test(state)) return state;
  return stateNameToCode.get(state) ?? state.slice(0, 2);
}

export function getPlateStateSearchValues(input: string | null | undefined): string[] {
  const normalized = normalizePlateState(input);
  if (!normalized) return [];
  return Array.from(new Set([normalized, stateCodeToName.get(normalized)].filter(Boolean) as string[]));
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

export function plateMatches(storedPlate: string | null | undefined, queryPlate: string | null | undefined): boolean {
  return platesMatch(storedPlate, queryPlate);
}

export function stateMatches(storedState: string | null | undefined, queryState: string | null | undefined): boolean {
  const stored = normalizePlateState(storedState);
  const query = normalizePlateState(queryState);
  return Boolean(stored && query && stored === query);
}
