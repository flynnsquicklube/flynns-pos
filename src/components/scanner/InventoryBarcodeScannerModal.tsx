import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ScanLine, X } from "lucide-react";
import { BarcodeFormat, BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type ScannerStatus = "idle" | "requesting_permission" | "scanning" | "found" | "denied" | "no_camera" | "error";

interface InventoryBarcodeScannerModalProps {
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  title?: string;
}

interface NativeBarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string; rawValueAsString?: string }>>;
}

type CameraTrackConstraints = MediaTrackConstraintSet & { torch?: boolean; focusMode?: string };

declare global {
  interface Window { BarcodeDetector?: NativeBarcodeDetectorConstructor; }
}

const zxingFormats = [
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_128,
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR
];

const nativeFormats = ["code_39", "code_128", "ean_8", "ean_13", "upc_a", "upc_e", "qr_code", "data_matrix", "itf", "codabar"];
const scanRegion = { x: 0.05, y: 0.3, width: 0.9, height: 0.35 };

function getCanvasContext(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d", { willReadFrequently: true });
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function cropVideoToScanRegion(video: HTMLVideoElement): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const canvas = createCanvas(vw * scanRegion.width, vh * scanRegion.height);
  const ctx = getCanvasContext(canvas);
  if (!ctx) return null;
  ctx.drawImage(video, vw * scanRegion.x, vh * scanRegion.y, vw * scanRegion.width, vh * scanRegion.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function choosePreferredDevice(devices: MediaDeviceInfo[]): string | undefined {
  return devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ?? devices[0]?.deviceId;
}

function classifyCameraError(error: unknown): ScannerStatus {
  const msg = `${error instanceof DOMException ? error.name : ""} ${error instanceof Error ? error.message : ""}`;
  if (/notallowed|security|permission|denied/i.test(msg)) return "denied";
  if (/notfound|devicesnotfound|no.*device|overconstrained/i.test(msg)) return "no_camera";
  return "error";
}

export function InventoryBarcodeScannerModal({ onClose, onBarcodeScanned, title = "Scan Barcode" }: InventoryBarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const nativeLoopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const acceptedRef = useRef(false);
  const nativeDetectorRef = useRef<NativeBarcodeDetector | null>(null);
  const lastScanAtRef = useRef(0);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [manualValue, setManualValue] = useState("");
  const [attempts, setAttempts] = useState(0);
  const nativeAvailable = typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(window.BarcodeDetector);

  const stopScanner = useCallback(() => {
    if (nativeLoopRef.current) {
      window.cancelAnimationFrame(nativeLoopRef.current);
      nativeLoopRef.current = null;
    }
    controlsRef.current?.stop();
    controlsRef.current = null;
    nativeDetectorRef.current = null;
    BrowserCodeReader.releaseAllStreams();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  const acceptBarcode = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed || acceptedRef.current) return;
    acceptedRef.current = true;
    setStatus("found");
    stopScanner();
    window.setTimeout(() => onBarcodeScanned(trimmed), 80);
  }, [onBarcodeScanned, stopScanner]);

  const configureTrack = useCallback(async (stream: MediaStream) => {
    const [track] = stream.getVideoTracks();
    if (!track) return;
    const capabilities = "getCapabilities" in track ? track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] } : {};
    if (capabilities.focusMode?.includes("continuous")) {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as CameraTrackConstraints] }).catch(() => undefined);
    }
  }, []);

  const tryDecodeCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    // Try native first
    if (window.BarcodeDetector && nativeDetectorRef.current) {
      try {
        const results = await nativeDetectorRef.current.detect(canvas);
        const raw = results[0]?.rawValue ?? results[0]?.rawValueAsString ?? null;
        if (raw) return raw;
      } catch { /* ignore */ }
    }
    // Try ZXing
    try {
      const reader = new BrowserMultiFormatReader();
      reader.possibleFormats = zxingFormats;
      const result = reader.decodeFromCanvas(canvas);
      if (result) return result.getText();
    } catch { /* ignore */ }
    return null;
  }, []);

  const startNativeScanner = useCallback(async (deviceId?: string) => {
    setStatus("requesting_permission");
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;
    await configureTrack(stream);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    const supportedFormats = window.BarcodeDetector?.getSupportedFormats
      ? await window.BarcodeDetector.getSupportedFormats().catch(() => nativeFormats)
      : nativeFormats;
    const formats = nativeFormats.filter((f) => supportedFormats.includes(f));
    nativeDetectorRef.current = new window.BarcodeDetector!({ formats: formats.length ? formats : undefined });
    setStatus("scanning");

    const scanFrame = async () => {
      if (acceptedRef.current || !videoRef.current || !nativeDetectorRef.current) return;
      if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const now = Date.now();
        if (now - lastScanAtRef.current >= 300) {
          lastScanAtRef.current = now;
          setAttempts((n) => n + 1);
          const crop = cropVideoToScanRegion(videoRef.current);
          if (crop) {
            const raw = await tryDecodeCanvas(crop).catch(() => null);
            if (raw) { acceptBarcode(raw); return; }
          }
        }
      }
      nativeLoopRef.current = window.requestAnimationFrame(scanFrame);
    };
    nativeLoopRef.current = window.requestAnimationFrame(scanFrame);
  }, [acceptBarcode, configureTrack, tryDecodeCanvas]);

  const startZxingScanner = useCallback(async (deviceId?: string) => {
    setStatus("requesting_permission");
    const reader = new BrowserMultiFormatReader();
    reader.possibleFormats = zxingFormats;
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    };
    controlsRef.current = await reader.decodeFromConstraints(constraints, videoRef.current ?? undefined, (result, error) => {
      if (error && !result) return;
      const raw = result?.getText();
      if (raw) acceptBarcode(raw);
      setAttempts((n) => n + 1);
    });
    setStatus("scanning");
    if (videoRef.current?.srcObject instanceof MediaStream) {
      streamRef.current = videoRef.current.srcObject;
      await configureTrack(videoRef.current.srcObject);
    }
  }, [acceptBarcode, configureTrack]);

  const startScanner = useCallback(async (deviceId = selectedDeviceId) => {
    stopScanner();
    acceptedRef.current = false;
    lastScanAtRef.current = 0;
    setAttempts(0);
    setStatus("requesting_permission");
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("no_camera"); return; }
    try {
      const videoInputs = await BrowserCodeReader.listVideoInputDevices().catch(() => [] as MediaDeviceInfo[]);
      setDevices(videoInputs);
      const nextDeviceId = deviceId ?? choosePreferredDevice(videoInputs);
      if (nextDeviceId) setSelectedDeviceId(nextDeviceId);
      if (nativeAvailable) {
        await startNativeScanner(nextDeviceId);
      } else {
        await startZxingScanner(nextDeviceId);
      }
    } catch (nativeError) {
      if (nativeAvailable) {
        try { await startZxingScanner(deviceId); return; } catch { /* fall through */ }
      }
      setStatus(classifyCameraError(nativeError));
    }
  }, [nativeAvailable, selectedDeviceId, startNativeScanner, startZxingScanner, stopScanner]);

  useEffect(() => {
    void startScanner();
    return stopScanner;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { stopScanner(); onClose(); };

  const submitManual = () => {
    if (manualValue.trim()) acceptBarcode(manualValue);
  };

  const statusText: Record<ScannerStatus, string> = {
    idle: "Ready",
    requesting_permission: "Requesting camera access...",
    scanning: `Scanning for barcode... (${attempts} frames)`,
    found: "Barcode detected!",
    denied: "Camera permission denied. Enter barcode manually below.",
    no_camera: "No camera found. Enter barcode manually below.",
    error: "Camera error. Enter barcode manually below."
  };

  const cameraBlocked = status === "denied" || status === "no_camera" || status === "error";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-panel)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--pos-border)] border-t-4 border-t-emerald-500 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <ScanLine size={18} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-black text-[var(--pos-text)]">{title}</h2>
          </div>
          <button type="button" className="rounded-xl p-2 text-[var(--pos-muted)] hover:bg-[var(--pos-card-hover)]" onClick={close} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Camera viewfinder */}
        <div className="relative bg-black">
          <video
            ref={videoRef}
            className="w-full"
            style={{ maxHeight: 280, objectFit: "cover" }}
            playsInline
            muted
            autoPlay
          />
          {/* Scan region overlay */}
          {status === "scanning" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-24 w-80 rounded-2xl">
                <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/70" />
                <div className="absolute -top-0.5 -left-0.5 h-5 w-5 rounded-tl-xl border-t-4 border-l-4 border-emerald-400" />
                <div className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-tr-xl border-t-4 border-r-4 border-emerald-400" />
                <div className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />
                <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />
              </div>
            </div>
          ) : null}
          {status === "found" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-900/60">
              <div className="rounded-2xl bg-emerald-500 px-6 py-3 text-lg font-black text-white">Barcode Scanned!</div>
            </div>
          ) : null}
          {cameraBlocked ? (
            <div className="flex h-44 items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-white/60">
                <Camera size={40} />
                <span className="text-sm">Camera unavailable</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Status + controls */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--pos-muted)]">{statusText[status]}</span>
            {devices.length > 1 ? (
              <select
                className="h-9 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel)] px-2 text-xs font-semibold text-[var(--pos-text)]"
                value={selectedDeviceId ?? ""}
                onChange={(event) => { const id = event.target.value; setSelectedDeviceId(id); void startScanner(id); }}
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="border-t border-[var(--pos-border)] pt-4">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)] mb-2">Manual Entry</div>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Type or paste barcode..."
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") submitManual(); }}
              />
              <Button disabled={!manualValue.trim()} onClick={submitManual}>Use</Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {!cameraBlocked && status !== "found" ? (
              <Button variant="secondary" onClick={() => void startScanner()}>Restart Camera</Button>
            ) : null}
            <Button variant="secondary" onClick={close}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
