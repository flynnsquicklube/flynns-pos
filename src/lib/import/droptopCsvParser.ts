import type { ParsedCsvRow } from "./importTypes";

export function cleanValue(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "").replace(/\t/g, "").trim();
  if (!cleaned || cleaned === "-") return null;
  return cleaned;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseDroptopCsv(text: string, requiredHeaders: string[]): ParsedCsvRow[] {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => requiredHeaders.every((header) => row.some((cell) => cleanValue(cell) === header)));
  if (headerIndex < 0) {
    throw new Error(`Could not find Droptop CSV header row containing ${requiredHeaders.join(", ")}.`);
  }
  const headers = rows[headerIndex].map((header) => cleanValue(header) ?? "");
  return rows
    .slice(headerIndex + 1)
    .map((row, offset) => {
      const values: Record<string, string | null> = {};
      headers.forEach((header, index) => {
        if (header) values[header] = cleanValue(row[index]);
      });
      return { rowNumber: headerIndex + offset + 2, values };
    })
    .filter((row) => Object.values(row.values).some(Boolean));
}

export function parseMoney(value: string | null | undefined): number {
  const cleaned = cleanValue(value);
  if (!cleaned) return 0;
  const parsed = Number(cleaned.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseNumber(value: string | null | undefined): number | null {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  const parsed = Number(cleaned.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMileage(value: string | null | undefined): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

export function parseDateTime(dateValue: string | null | undefined, timeValue: string | null | undefined): string {
  const date = cleanValue(dateValue);
  const time = cleanValue(timeValue);
  const parsed = new Date([date, time].filter(Boolean).join(" "));
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export function splitList(value: string | null | undefined): string[] {
  const cleaned = cleanValue(value);
  if (!cleaned) return [];
  return cleaned
    .split(/[,;]\s*/)
    .map((item) => cleanValue(item))
    .filter((item): item is string => Boolean(item));
}

export function normalizeText(value: string | null | undefined): string {
  return cleanValue(value)?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

export function normalizePhone(value: string | null | undefined): string | null {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  return digits || cleaned;
}
