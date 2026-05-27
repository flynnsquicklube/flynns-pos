import { createWorker, PSM } from "tesseract.js";
import { extractVinFromScannedText, type VinExtractionResult } from "../domain/vehicles/vinUtils";

export interface VinOcrScanResult {
  rawText: string;
  normalizedText: string;
  extraction: VinExtractionResult;
  preprocessing: string;
  confidence: number | null;
}

const vinWhitelist = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

function getContext(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d", { willReadFrequently: true });
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function cloneScaled(source: HTMLCanvasElement, scale: number) {
  const canvas = createCanvas(source.width * scale, source.height * scale);
  const context = getContext(canvas);
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function enhanceForOcr(source: HTMLCanvasElement, mode: "contrast" | "threshold") {
  const canvas = cloneScaled(source, 3);
  if (!canvas) return null;
  const context = getContext(canvas);
  if (!context) return null;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    const value = mode === "threshold" ? (gray > 135 ? 255 : 0) : Math.max(0, Math.min(255, ((gray - 128) * 2.2) + 128));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

export function preprocessVinFrame(canvas: HTMLCanvasElement) {
  return [
    { name: "contrast-3x", canvas: enhanceForOcr(canvas, "contrast") },
    { name: "threshold-3x", canvas: enhanceForOcr(canvas, "threshold") },
    { name: "scaled-3x", canvas: cloneScaled(canvas, 3) }
  ].filter((item): item is { name: string; canvas: HTMLCanvasElement } => Boolean(item.canvas));
}

export function extractVinFromOcrText(text: string): VinExtractionResult {
  const compact = text
    .toUpperCase()
    .replace(/[|]/g, "1")
    .replace(/[’']/g, "")
    .replace(/\b(VIN|VEHICLE|SERIAL|ID)\b:?/g, " ")
    .replace(/[^A-Z0-9]/g, "");

  const direct = extractVinFromScannedText(compact);
  if (direct.isValid) return direct;

  const cautiousNumericFix = compact
    .replace(/(?<=\d)O(?=\d)/g, "0")
    .replace(/(?<=\d)I(?=\d)/g, "1");
  return extractVinFromScannedText(cautiousNumericFix);
}

export async function scanVinTextFromImage(canvas: HTMLCanvasElement): Promise<VinOcrScanResult> {
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_char_whitelist: vinWhitelist,
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "0",
      user_defined_dpi: "300"
    });

    let best: VinOcrScanResult | null = null;
    for (const variant of preprocessVinFrame(canvas)) {
      const result = await worker.recognize(variant.canvas);
      const rawText = result.data.text ?? "";
      const extraction = extractVinFromOcrText(rawText);
      const normalizedText = rawText.toUpperCase().replace(/\s+/g, " ").trim();
      const scanResult: VinOcrScanResult = {
        rawText,
        normalizedText,
        extraction,
        preprocessing: variant.name,
        confidence: typeof result.data.confidence === "number" ? result.data.confidence : null
      };
      if (extraction.isValid) return scanResult;
      if (!best || (scanResult.confidence ?? 0) > (best.confidence ?? 0)) best = scanResult;
    }
    return best ?? {
      rawText: "",
      normalizedText: "",
      extraction: extractVinFromScannedText(""),
      preprocessing: "none",
      confidence: null
    };
  } finally {
    await worker.terminate();
  }
}
