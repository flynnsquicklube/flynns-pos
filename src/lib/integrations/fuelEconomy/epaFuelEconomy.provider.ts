import type { FuelEconomyVehicleCandidate } from "./fuelEconomy.types";

const BASE_URL = "https://www.fueleconomy.gov/ws/rest";

function xmlText(xml: Document, tagName: string): string | null {
  const value = xml.getElementsByTagName(tagName)[0]?.textContent?.trim();
  return value || null;
}

function numberOrNull(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchXml(path: string, timeoutMs = 8000): Promise<Document> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, { signal: controller.signal, headers: { Accept: "application/xml" } });
    if (!response.ok) throw new Error(`FuelEconomy.gov returned ${response.status}.`);
    const text = await response.text();
    return new DOMParser().parseFromString(text, "application/xml");
  } finally {
    window.clearTimeout(timeout);
  }
}

function menuItems(xml: Document): string[] {
  return Array.from(xml.getElementsByTagName("menuItem"))
    .map((item) => item.getElementsByTagName("text")[0]?.textContent?.trim() ?? "")
    .filter(Boolean);
}

function optionItems(xml: Document): Array<{ id: string; text: string }> {
  return Array.from(xml.getElementsByTagName("menuItem"))
    .map((item) => ({
      id: item.getElementsByTagName("value")[0]?.textContent?.trim() ?? "",
      text: item.getElementsByTagName("text")[0]?.textContent?.trim() ?? ""
    }))
    .filter((item) => item.id && item.text);
}

export async function listMakes(year: number): Promise<string[]> {
  return menuItems(await fetchXml(`/vehicle/menu/make?year=${encodeURIComponent(String(year))}`));
}

export async function listModels(year: number, make: string): Promise<string[]> {
  return menuItems(await fetchXml(`/vehicle/menu/model?year=${encodeURIComponent(String(year))}&make=${encodeURIComponent(make)}`));
}

export async function listOptions(year: number, make: string, model: string): Promise<Array<{ id: string; text: string }>> {
  return optionItems(await fetchXml(`/vehicle/menu/options?year=${encodeURIComponent(String(year))}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`));
}

export async function getVehicleDetails(vehicleId: string): Promise<FuelEconomyVehicleCandidate> {
  const xml = await fetchXml(`/vehicle/${encodeURIComponent(vehicleId)}`);
  return {
    epaVehicleId: vehicleId,
    year: numberOrNull(xmlText(xml, "year")),
    make: xmlText(xml, "make"),
    model: xmlText(xml, "model"),
    trim: xmlText(xml, "trany") ?? xmlText(xml, "VClass"),
    fuelType: xmlText(xml, "fuelType") ?? xmlText(xml, "fuelType1"),
    cylinders: numberOrNull(xmlText(xml, "cylinders")),
    displacement: numberOrNull(xmlText(xml, "displ")),
    transmission: xmlText(xml, "trany"),
    drive: xmlText(xml, "drive"),
    vehicleClass: xmlText(xml, "VClass"),
    mpgCity: numberOrNull(xmlText(xml, "city08")),
    mpgHighway: numberOrNull(xmlText(xml, "highway08")),
    mpgCombined: numberOrNull(xmlText(xml, "comb08")),
    raw: new XMLSerializer().serializeToString(xml)
  };
}

export async function searchVehicleCandidates(year: number, make: string, model: string): Promise<FuelEconomyVehicleCandidate[]> {
  const options = await listOptions(year, make, model);
  const details = await Promise.all(options.slice(0, 12).map((option) => getVehicleDetails(option.id).catch(() => null)));
  return details.filter((item): item is FuelEconomyVehicleCandidate => Boolean(item));
}
