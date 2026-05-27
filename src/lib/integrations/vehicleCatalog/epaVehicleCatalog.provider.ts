import type { VehicleCatalogMake, VehicleCatalogModel, VehicleCatalogOption, VehicleCatalogProvider, VehicleCatalogYear } from "./vehicleCatalog.types";

const EPA_BASE_URL = "https://www.fueleconomy.gov/ws/rest";

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/xml,text/xml,*/*" } });
    if (!response.ok) throw new Error(`EPA request failed: ${response.status}`);
    return await response.text();
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseXml(text: string): Document {
  const parsed = new DOMParser().parseFromString(text, "application/xml");
  if (parsed.querySelector("parsererror")) throw new Error("EPA returned invalid XML.");
  return parsed;
}

function textContent(node: Element | Document, selector: string): string {
  return node.querySelector(selector)?.textContent?.trim() ?? "";
}

function parseMenuItems(text: string): Array<{ text: string; value: string }> {
  const doc = parseXml(text);
  const items = Array.from(doc.querySelectorAll("menuItem"));
  if (items.length) {
    return items.map((item) => ({
      text: textContent(item, "text") || item.textContent?.trim() || "",
      value: textContent(item, "value") || textContent(item, "id") || textContent(item, "text")
    })).filter((item) => item.text);
  }
  return Array.from(doc.querySelectorAll("value, text"))
    .map((node) => ({ text: node.textContent?.trim() ?? "", value: node.textContent?.trim() ?? "" }))
    .filter((item) => item.text);
}

function detail(doc: Document, selector: string): string | null {
  const value = textContent(doc, selector);
  return value || null;
}

function buildEngine(doc: Document) {
  const displacement = detail(doc, "displ");
  const cylinders = detail(doc, "cylinders");
  const fuel = detail(doc, "fuelType") ?? detail(doc, "fuelType1");
  return [displacement ? `${displacement}L` : null, cylinders ? `${cylinders} cyl` : null, fuel].filter(Boolean).join(" ") || null;
}

function normalizeOptionFromDetail(id: string, doc: Document, raw: string): VehicleCatalogOption {
  const year = Number(detail(doc, "year")) || 0;
  const make = detail(doc, "make") ?? "";
  const model = detail(doc, "model") ?? "";
  return {
    id,
    year,
    make,
    model,
    trim: detail(doc, "trany") || detail(doc, "VClass"),
    engine: buildEngine(doc),
    displacement: detail(doc, "displ"),
    cylinders: detail(doc, "cylinders"),
    transmission: detail(doc, "trany"),
    drive: detail(doc, "drive"),
    fuelType: detail(doc, "fuelType") ?? detail(doc, "fuelType1"),
    bodyClass: detail(doc, "VClass"),
    source: "epa_fueleconomy",
    raw
  };
}

export const epaVehicleCatalogProvider: VehicleCatalogProvider = {
  async listYears(): Promise<VehicleCatalogYear[]> {
    const text = await fetchText(`${EPA_BASE_URL}/vehicle/menu/year`);
    return parseMenuItems(text)
      .map((item) => ({ year: Number(item.value || item.text) }))
      .filter((item) => Number.isFinite(item.year))
      .sort((a, b) => b.year - a.year);
  },

  async listMakesForYear(year: number): Promise<VehicleCatalogMake[]> {
    const text = await fetchText(`${EPA_BASE_URL}/vehicle/menu/make?year=${encodeURIComponent(year)}`);
    return parseMenuItems(text).map((item) => ({ makeId: item.value, makeName: item.text }));
  },

  async listModelsForYearMake(year: number, make: string): Promise<VehicleCatalogModel[]> {
    const text = await fetchText(`${EPA_BASE_URL}/vehicle/menu/model?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`);
    return parseMenuItems(text).map((item) => ({ modelId: item.value, modelName: item.text }));
  },

  async listOptionsForYearMakeModel(year: number, make: string, model: string): Promise<VehicleCatalogOption[]> {
    const text = await fetchText(`${EPA_BASE_URL}/vehicle/menu/options?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const menuItems = parseMenuItems(text);
    return menuItems.map((item) => ({
      id: String(item.value || item.text),
      year,
      make,
      model,
      trim: item.text,
      engine: null,
      displacement: null,
      cylinders: null,
      transmission: null,
      drive: null,
      fuelType: null,
      bodyClass: null,
      source: "epa_fueleconomy",
      raw: item
    }));
  },

  async getOptionDetails(optionId: string): Promise<VehicleCatalogOption | null> {
    if (!optionId) return null;
    const text = await fetchText(`${EPA_BASE_URL}/vehicle/${encodeURIComponent(optionId)}`);
    return normalizeOptionFromDetail(optionId, parseXml(text), text);
  }
};
