export interface VinExtractionResult {
  raw: string;
  normalized: string;
  candidate: string;
  vinCandidate: string | null;
  isValid: boolean;
  reason: string | null;
}

const validVinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;
const invalidVinLettersPattern = /[IOQ]/;
const labelPattern = /\b(VIN|VEHICLE|VEHICLEID|VEHICLE ID|SERIAL|SERIALNUMBER|SERIAL NUMBER)\b:?/g;

export function normalizeVin(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(labelPattern, "")
    .replace(/[\s\-*:]+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function isValidVin(input: string): boolean {
  return validVinPattern.test(normalizeVin(input));
}

export function isLikelyVin(input: string): boolean {
  const normalized = normalizeVin(input);
  return normalized.length <= 17 && /^[A-HJ-NPR-Z0-9]*$/.test(normalized);
}

function invalidReason(candidate: string | null, normalized: string): string {
  if (!candidate && !normalized) return "No barcode text was detected.";
  if (candidate && invalidVinLettersPattern.test(candidate)) return "VIN candidates cannot contain I, O, or Q.";
  if (normalized && normalized.length < 17) return `VIN candidate is too short (${normalized.length}/17).`;
  if (normalized && normalized.length > 17 && !candidate) return "Barcode text did not contain a clean 17-character VIN candidate.";
  if (candidate && candidate.length !== 17) return `VIN candidate must be 17 characters (${candidate.length}/17).`;
  return "VIN candidate contains unsupported characters.";
}

function result(raw: string, normalized: string, candidate: string, isValid: boolean, reason: string | null): VinExtractionResult {
  return {
    raw,
    normalized,
    candidate: isValid ? candidate : "",
    vinCandidate: isValid ? candidate : candidate || null,
    isValid,
    reason
  };
}

export function extractVinFromScannedText(input: string): VinExtractionResult {
  const raw = input;
  const normalized = normalizeVin(input);

  if (isValidVin(normalized)) {
    return result(raw, normalized, normalized, true, null);
  }

  const cleanedForSearch = input
    .toUpperCase()
    .replace(labelPattern, " ")
    .replace(/[*:-]/g, " ");

  const candidates = [
    ...(cleanedForSearch.match(/[A-HJ-NPR-Z0-9]{17}/g) ?? []),
    ...(normalized.match(/[A-HJ-NPR-Z0-9]{17}/g) ?? [])
  ];
  const validCandidate = candidates.find(isValidVin) ?? null;

  if (validCandidate) {
    if (candidates.filter(isValidVin).length > 1) {
      console.warn("[vin-utils] Multiple valid VIN candidates found; using first.", candidates);
    }
    return result(raw, normalized, validCandidate, true, null);
  }

  const cautiouslyCorrected = normalized
    .replace(/(?<=\d)O(?=\d)/g, "0")
    .replace(/(?<=\d)I(?=\d)/g, "1");
  if (isValidVin(cautiouslyCorrected)) {
    return result(raw, normalized, cautiouslyCorrected, true, null);
  }

  const broadCandidate = cleanedForSearch.match(/[A-Z0-9]{17}/)?.[0] ?? null;
  const invalidCandidate = broadCandidate ?? candidates[0] ?? null;
  return result(raw, normalized, invalidCandidate ?? "", false, invalidReason(invalidCandidate, normalized));
}

export const vinExtractionExamples = [
  { input: "JM3KKCHD2R1102815", expected: "JM3KKCHD2R1102815" },
  { input: "VIN: JM3KKCHD2R1102815", expected: "JM3KKCHD2R1102815" },
  { input: "*JM3KKCHD2R1102815*", expected: "JM3KKCHD2R1102815" },
  { input: "J M 3 K K C H D 2 R 1 1 0 2 8 1 5", expected: "JM3KKCHD2R1102815" },
  { input: "VIN JM3KKCHD2R1102815 BODY COLOR BLACK", expected: "JM3KKCHD2R1102815" },
  { input: "TEXT BEFORE JM3KKCHD2R1102815 TEXT AFTER", expected: "JM3KKCHD2R1102815" },
  { input: "THIS IS NOT A VIN", expected: "" }
] as const;

export function validateVinExtractionExamples(): boolean {
  return vinExtractionExamples.every((example) => extractVinFromScannedText(example.input).candidate === example.expected);
}

export const isValidVinCandidate = isValidVin;
export const cleanScannedVin = extractVinFromScannedText;
