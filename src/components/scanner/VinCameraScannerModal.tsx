import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Flashlight, Pause, Play, RotateCcw, ScanLine, X } from "lucide-react";
import { BarcodeFormat, BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "../ui/Button";
import { extractVinFromScannedText, type VinExtractionResult } from "../../lib/domain/vehicles/vinUtils";
import { scanVinTextFromImage, type VinOcrScanResult } from "../../lib/scanner/vinOcrScanner";

type ScannerStatus = "idle" | "requesting_permission" | "scanning" | "paused" | "found" | "invalid" | "denied" | "no_camera" | "error" | "stopped";
type ScannerEngine = "auto" | "native" | "zxing";
type ActiveEngine = "native" | "zxing" | "ocr" | "none";
type PermissionStatusLabel = "unknown" | "requesting" | "granted" | "denied" | "unavailable";
type VideoStatus = "not_started" | "starting" | "playing" | "stopped" | "error";
type EnhancementName = "original" | "grayscale" | "contrast" | "threshold" | "scaled";

interface VinCameraScannerModalProps {
  onClose: () => void;
  onVinScanned: (vin: string, diagnostics?: VinScannerResult) => void;
}

export interface VinScannerResult {
  vin: string;
  rawValue: string | null;
  engine: ActiveEngine;
  cameraLabel: string | null;
  attempts: number;
}

interface NativeBarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string; rawValueAsString?: string }>>;
}

type CameraTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min?: number; max?: number; step?: number };
  focusMode?: string[];
};

type CameraTrackConstraints = MediaTrackConstraintSet & {
  torch?: boolean;
  zoom?: number;
  focusMode?: string;
};

declare global {
  interface Window {
    BarcodeDetector?: NativeBarcodeDetectorConstructor;
  }
}

const zxingFormats = [
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC
];

const nativeFormats = ["code_39", "code_128", "data_matrix", "qr_code", "pdf417", "aztec"];
const formatLabel = "CODE_39, CODE_128, DATA_MATRIX, QR_CODE, PDF_417, AZTEC";
const enhancementOrder: EnhancementName[] = ["original", "grayscale", "contrast", "threshold", "scaled"];
const scanRegion = { x: 0.1, y: 0.34, width: 0.8, height: 0.26 };

function statusMessage(status: ScannerStatus, detail?: string | null): string {
  if (status === "idle") return "Ready to start camera.";
  if (status === "requesting_permission") return "Requesting camera permission...";
  if (status === "scanning") return "Looking for VIN barcode...";
  if (status === "paused") return "Scanner paused.";
  if (status === "found") return "VIN found.";
  if (status === "invalid") return "Barcode detected, but it is not a valid VIN.";
  if (status === "denied") return "Camera permission was denied. Type the VIN or use a USB scanner.";
  if (status === "no_camera") return "No camera found. Use manual entry or USB scanner.";
  if (status === "stopped") return "Camera stopped.";
  return detail || "Camera scanning is not available in this environment. Type the VIN or use a USB scanner.";
}

function cameraLabel(device: MediaDeviceInfo | undefined, index = 0): string {
  return device?.label || `Camera ${index + 1}`;
}

function choosePreferredDevice(devices: MediaDeviceInfo[]): string | undefined {
  return devices.find((device) => /back|rear|environment/i.test(device.label))?.deviceId ?? devices[0]?.deviceId;
}

function classifyCameraError(error: unknown): ScannerStatus {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "Unable to start camera.";
  if (/notallowed|security|permission|denied/i.test(`${name} ${message}`)) return "denied";
  if (/notfound|devicesnotfound|no.*device|overconstrained/i.test(`${name} ${message}`)) return "no_camera";
  return "error";
}

function devLog(message: string, payload?: unknown) {
  if (import.meta.env.DEV) {
    if (payload === undefined) console.log(`[vin-scanner] ${message}`);
    else console.log(`[vin-scanner] ${message}`, payload);
  }
}

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
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) return null;
  const sourceX = videoWidth * scanRegion.x;
  const sourceY = videoHeight * scanRegion.y;
  const sourceWidth = videoWidth * scanRegion.width;
  const sourceHeight = videoHeight * scanRegion.height;
  const canvas = createCanvas(sourceWidth, sourceHeight);
  const context = getCanvasContext(canvas);
  if (!context) return null;
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cloneCanvas(source: HTMLCanvasElement, scale = 1) {
  const canvas = createCanvas(source.width * scale, source.height * scale);
  const context = getCanvasContext(canvas);
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function enhanceCanvas(source: HTMLCanvasElement, enhancement: EnhancementName) {
  if (enhancement === "scaled") return cloneCanvas(source, 2);
  const canvas = cloneCanvas(source);
  if (!canvas) return null;
  if (enhancement === "original") return canvas;
  const context = getCanvasContext(canvas);
  if (!context) return null;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    let next = gray;
    if (enhancement === "contrast") next = Math.max(0, Math.min(255, ((gray - 128) * 1.8) + 128));
    if (enhancement === "threshold") next = gray > 142 ? 255 : 0;
    data[index] = next;
    data[index + 1] = next;
    data[index + 2] = next;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function makeEnhancedCanvases(source: HTMLCanvasElement) {
  return enhancementOrder
    .map((name) => ({ name, canvas: enhanceCanvas(source, name) }))
    .filter((item): item is { name: EnhancementName; canvas: HTMLCanvasElement } => Boolean(item.canvas));
}

export function VinCameraScannerModal({ onClose, onVinScanned }: VinCameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const nativeLoopRef = useRef<number | null>(null);
  const stillLookingTimerRef = useRef<number | null>(null);
  const autoOcrDelayRef = useRef<number | null>(null);
  const autoOcrIntervalRef = useRef<number | null>(null);
  const nativeDetectorRef = useRef<NativeBarcodeDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(false);
  const acceptedRef = useRef(false);
  const ocrBusyRef = useRef(false);
  const ocrRunIdRef = useRef(0);
  const attemptsRef = useRef(0);
  const fpsFrameRef = useRef({ frames: 0, startedAt: Date.now() });
  const lastNativeScanAtRef = useRef(0);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatusLabel>("unknown");
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("not_started");
  const [engineChoice, setEngineChoice] = useState<ScannerEngine>("auto");
  const [activeEngine, setActiveEngine] = useState<ActiveEngine>("none");
  const [engineStatus, setEngineStatus] = useState("Not started");
  const [detail, setDetail] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [lastExtraction, setLastExtraction] = useState<VinExtractionResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [fps, setFps] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [manualVin, setManualVin] = useState("");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomAvailable, setZoomAvailable] = useState(false);
  const [zoomValue, setZoomValue] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [attemptedEnhancements, setAttemptedEnhancements] = useState<EnhancementName[]>([]);
  const [successfulEnhancement, setSuccessfulEnhancement] = useState<EnhancementName | null>(null);
  const [showStillLooking, setShowStillLooking] = useState(false);
  const [rawTestValue, setRawTestValue] = useState("");
  const [rawTestExtraction, setRawTestExtraction] = useState<VinExtractionResult | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "preparing" | "reading" | "found" | "not_found" | "error">("idle");
  const [lastOcrResult, setLastOcrResult] = useState<VinOcrScanResult | null>(null);

  const selectedCamera = useMemo(() => devices.find((device) => device.deviceId === selectedDeviceId), [devices, selectedDeviceId]);
  const nativeAvailable = typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(window.BarcodeDetector);
  const scannerActive = status === "requesting_permission" || status === "scanning";

  const loadDevices = useCallback(async () => {
    const videoInputs = await BrowserCodeReader.listVideoInputDevices();
    devLog("camera devices found", videoInputs.map((device) => ({ label: device.label, id: device.deviceId })));
    setDevices(videoInputs);
    setSelectedDeviceId((current) => current ?? choosePreferredDevice(videoInputs));
    return videoInputs;
  }, []);

  const stopScanner = useCallback(() => {
    if (stillLookingTimerRef.current) {
      window.clearTimeout(stillLookingTimerRef.current);
      stillLookingTimerRef.current = null;
    }
    if (autoOcrDelayRef.current) {
      window.clearTimeout(autoOcrDelayRef.current);
      autoOcrDelayRef.current = null;
    }
    if (autoOcrIntervalRef.current) {
      window.clearInterval(autoOcrIntervalRef.current);
      autoOcrIntervalRef.current = null;
    }
    ocrRunIdRef.current += 1;
    ocrBusyRef.current = false;
    if (nativeLoopRef.current) {
      window.cancelAnimationFrame(nativeLoopRef.current);
      nativeLoopRef.current = null;
    }
    controlsRef.current?.stop();
    controlsRef.current = null;
    nativeDetectorRef.current = null;
    BrowserCodeReader.releaseAllStreams();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setTorchOn(false);
    setTorchAvailable(false);
    setZoomAvailable(false);
    setVideoStatus("stopped");
    setActiveEngine("none");
    devLog("scanner stopped");
  }, []);

  const acceptVin = useCallback((vin: string, rawValue: string | null, engine: ActiveEngine) => {
    const extraction = extractVinFromScannedText(vin);
    if (!extraction.isValid || !extraction.candidate || extraction.candidate.length !== 17) {
      setLastExtraction(extraction);
      setDetail(extraction.reason ?? "No valid 17-character VIN was found.");
      setStatus("scanning");
      devLog("finishVinScan rejected invalid VIN", { vin, extraction });
      return;
    }
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    setStatus("found");
    stopScanner();
    devLog("VIN accepted", { vin: extraction.candidate, rawValue, engine });
    window.setTimeout(() => {
      onVinScanned(extraction.candidate, {
        vin: extraction.candidate,
        rawValue,
        engine,
        cameraLabel: selectedCamera?.label ?? null,
        attempts: attemptsRef.current
      });
    }, 120);
  }, [onVinScanned, selectedCamera?.label, stopScanner]);

  const inspectRawValue = useCallback((raw: string, engine: ActiveEngine) => {
    const extraction = extractVinFromScannedText(raw);
    setLastScanned(raw);
    setLastExtraction(extraction);
    devLog("barcode raw value detected", { raw, engine, extraction });
    if (extraction.isValid && extraction.candidate) {
      acceptVin(extraction.candidate, raw, engine);
      return true;
    }
    setStatus("scanning");
    setDetail(extraction.reason);
    devLog("VIN rejected", extraction.reason);
    return false;
  }, [acceptVin]);

  const tickAttempt = useCallback(() => {
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    const now = Date.now();
    fpsFrameRef.current.frames += 1;
    const elapsed = now - fpsFrameRef.current.startedAt;
    if (elapsed >= 1000) {
      setFps(Math.round((fpsFrameRef.current.frames / elapsed) * 1000));
      fpsFrameRef.current = { frames: 0, startedAt: now };
    }
  }, []);

  const decodeCanvasWithNative = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!window.BarcodeDetector) return null;
    const supportedFormats = window.BarcodeDetector.getSupportedFormats ? await window.BarcodeDetector.getSupportedFormats().catch(() => nativeFormats) : nativeFormats;
    const formats = nativeFormats.filter((format) => supportedFormats.includes(format));
    const detector = new window.BarcodeDetector({ formats: formats.length ? formats : undefined });
    const results = await detector.detect(canvas);
    return results[0]?.rawValue ?? results[0]?.rawValueAsString ?? null;
  }, []);

  const decodeCanvasWithZxing = useCallback((canvas: HTMLCanvasElement) => {
    const reader = new BrowserMultiFormatReader();
    reader.possibleFormats = zxingFormats;
    const result = reader.decodeFromCanvas(canvas);
    return result.getText();
  }, []);

  const decodePreparedCanvases = useCallback(async (source: HTMLCanvasElement, preferredEngine: ScannerEngine = engineChoice) => {
    const variants = makeEnhancedCanvases(source);
    setAttemptedEnhancements(variants.map((variant) => variant.name));
    setSuccessfulEnhancement(null);
    for (const variant of variants) {
      tickAttempt();
      try {
        if ((preferredEngine === "native" || preferredEngine === "auto") && window.BarcodeDetector) {
          const raw = await decodeCanvasWithNative(variant.canvas);
          if (raw) {
            setSuccessfulEnhancement(variant.name);
            if (inspectRawValue(raw, "native")) return true;
          }
        }
      } catch (error) {
        devLog(`native still-frame decode failed (${variant.name})`, error);
      }
      try {
        if (preferredEngine === "zxing" || preferredEngine === "auto" || !window.BarcodeDetector) {
          const raw = decodeCanvasWithZxing(variant.canvas);
          if (raw) {
            setSuccessfulEnhancement(variant.name);
            if (inspectRawValue(raw, "zxing")) return true;
          }
        }
      } catch (error) {
        devLog(`ZXing still-frame decode failed (${variant.name})`, error);
      }
    }
    return false;
  }, [decodeCanvasWithNative, decodeCanvasWithZxing, engineChoice, inspectRawValue, tickAttempt]);

  const refreshDeviceListAfterPermission = useCallback(async () => {
    const refreshed = await loadDevices().catch(() => []);
    if (refreshed.length) {
      setSelectedDeviceId((current) => current ?? choosePreferredDevice(refreshed));
    }
  }, [loadDevices]);

  const configureTrack = useCallback(async (stream: MediaStream) => {
    const [track] = stream.getVideoTracks();
    if (!track) return;
    const capabilities = "getCapabilities" in track ? track.getCapabilities() as CameraTrackCapabilities : {};
    setTorchAvailable(Boolean(capabilities.torch));
    if (capabilities.zoom) {
      const min = capabilities.zoom.min ?? 1;
      const max = capabilities.zoom.max ?? min;
      const step = capabilities.zoom.step ?? 0.1;
      setZoomAvailable(max > min);
      setZoomRange({ min, max, step });
      setZoomValue(min);
    } else {
      setZoomAvailable(false);
    }
    if (capabilities.focusMode?.includes("continuous")) {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as CameraTrackConstraints] }).catch(() => undefined);
    }
  }, []);

  const startNativeScanner = useCallback(async (deviceId?: string) => {
    if (!window.BarcodeDetector) throw new Error("Native BarcodeDetector is not available in this Electron/Chromium environment.");
    setEngineStatus("Starting native BarcodeDetector");
    setActiveEngine("native");
    setPermissionStatus("requesting");
    setVideoStatus("starting");

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;
    setPermissionStatus("granted");
    await configureTrack(stream);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setVideoStatus("playing");
    await refreshDeviceListAfterPermission();
    const supportedFormats = window.BarcodeDetector.getSupportedFormats ? await window.BarcodeDetector.getSupportedFormats().catch(() => nativeFormats) : nativeFormats;
    const formats = nativeFormats.filter((format) => supportedFormats.includes(format));
    nativeDetectorRef.current = new window.BarcodeDetector({ formats: formats.length ? formats : undefined });
    setEngineStatus(`Native BarcodeDetector running${formats.length ? ` (${formats.join(", ")})` : ""}`);
    devLog("scanner engine selected", { engine: "native", formats });

    const scanFrame = async () => {
      if (pausedRef.current || acceptedRef.current || !nativeDetectorRef.current || !videoRef.current) return;
      if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const now = Date.now();
          if (now - lastNativeScanAtRef.current >= 400) {
            lastNativeScanAtRef.current = now;
            const crop = cropVideoToScanRegion(videoRef.current);
            if (crop) await decodePreparedCanvases(crop, engineChoice === "auto" ? "auto" : "native");
          }
        } catch (error) {
          setEngineStatus(error instanceof Error ? error.message : "Native scanner frame failed");
        }
      }
      nativeLoopRef.current = window.requestAnimationFrame(scanFrame);
    };
    nativeLoopRef.current = window.requestAnimationFrame(scanFrame);
  }, [configureTrack, decodePreparedCanvases, engineChoice, refreshDeviceListAfterPermission]);

  const startZxingScanner = useCallback(async (deviceId?: string) => {
    setEngineStatus("Starting ZXing scanner");
    setActiveEngine("zxing");
    setPermissionStatus("requesting");
    setVideoStatus("starting");
    const reader = new BrowserMultiFormatReader();
    reader.possibleFormats = zxingFormats;
    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    };
    controlsRef.current = await reader.decodeFromConstraints(constraints, videoRef.current ?? undefined, (result, error) => {
      if (pausedRef.current) return;
      tickAttempt();
      if (error && !result) return;
      const raw = result?.getText();
      if (raw) inspectRawValue(raw, "zxing");
    });
    setPermissionStatus("granted");
    setVideoStatus("playing");
    setEngineStatus("ZXing scanner running");
    await refreshDeviceListAfterPermission();
    if (videoRef.current?.srcObject instanceof MediaStream) {
      streamRef.current = videoRef.current.srcObject;
      await configureTrack(videoRef.current.srcObject);
    }
    devLog("scanner engine selected", { engine: "zxing" });
  }, [configureTrack, inspectRawValue, refreshDeviceListAfterPermission, tickAttempt]);

  const startScanner = useCallback(async (deviceId = selectedDeviceId, engine = engineChoice) => {
    stopScanner();
    acceptedRef.current = false;
    pausedRef.current = false;
    attemptsRef.current = 0;
    fpsFrameRef.current = { frames: 0, startedAt: Date.now() };
    setAttempts(0);
    setFps(0);
    setStatus("requesting_permission");
    setPermissionStatus("requesting");
    setDetail(null);
    setLastScanned(null);
    setLastExtraction(null);
    setCapturedFrame(null);
    setAttemptedEnhancements([]);
    setSuccessfulEnhancement(null);
    setShowStillLooking(false);
    stillLookingTimerRef.current = window.setTimeout(() => setShowStillLooking(true), 10000);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionStatus("unavailable");
      setStatus("no_camera");
      return;
    }

    try {
      const availableDevices = devices.length ? devices : await loadDevices().catch(() => []);
      const nextDeviceId = deviceId ?? choosePreferredDevice(availableDevices);
      if (nextDeviceId) setSelectedDeviceId(nextDeviceId);
      const requestedEngine: ScannerEngine = engine;
      if (requestedEngine === "native" || (requestedEngine === "auto" && nativeAvailable)) {
        await startNativeScanner(nextDeviceId);
      } else {
        await startZxingScanner(nextDeviceId);
      }
      setStatus("scanning");
    } catch (nativeError) {
      if (engine === "auto" && nativeAvailable) {
        devLog("native scanner failed; falling back to ZXing", nativeError);
        stopScanner();
        try {
          await startZxingScanner(deviceId);
          setStatus("scanning");
          return;
        } catch (zxingError) {
          setDetail(zxingError instanceof Error ? zxingError.message : "Unable to start camera.");
          setStatus(classifyCameraError(zxingError));
          setPermissionStatus(classifyCameraError(zxingError) === "denied" ? "denied" : "unknown");
          setVideoStatus("error");
          return;
        }
      }
      setDetail(nativeError instanceof Error ? nativeError.message : "Unable to start camera.");
      setStatus(classifyCameraError(nativeError));
      setPermissionStatus(classifyCameraError(nativeError) === "denied" ? "denied" : "unknown");
      setVideoStatus("error");
    }
  }, [devices, engineChoice, loadDevices, nativeAvailable, selectedDeviceId, startNativeScanner, startZxingScanner, stopScanner]);

  useEffect(() => {
    void startScanner();
    return stopScanner;
    // Start once when the modal opens. Camera/device changes are explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    stopScanner();
    onClose();
  };

  const togglePaused = () => {
    pausedRef.current = !pausedRef.current;
    setStatus(pausedRef.current ? "paused" : "scanning");
    if (!pausedRef.current && activeEngine === "native") {
      void startScanner(selectedDeviceId, "native");
    }
  };

  const toggleTorch = async () => {
    const stream = streamRef.current ?? (videoRef.current?.srcObject instanceof MediaStream ? videoRef.current.srcObject : null);
    const [track] = stream?.getVideoTracks() ?? [];
    if (!track) return;
    try {
      await BrowserCodeReader.mediaStreamSetTorch(track, !torchOn);
      setTorchOn(!torchOn);
    } catch (error) {
      setDetail(error instanceof Error ? error.message : "Torch is not supported by this camera.");
    }
  };

  const updateZoom = async (value: number) => {
    setZoomValue(value);
    const stream = streamRef.current ?? (videoRef.current?.srcObject instanceof MediaStream ? videoRef.current.srcObject : null);
    const [track] = stream?.getVideoTracks() ?? [];
    if (!track) return;
    await track.applyConstraints({ advanced: [{ zoom: value } as CameraTrackConstraints] }).catch((error) => {
      setDetail(error instanceof Error ? error.message : "Zoom is not supported by this camera.");
    });
  };

  const captureScanRegion = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setDetail("No readable video frame is available yet.");
      return null;
    }
    const crop = cropVideoToScanRegion(video);
    if (!crop) {
      setDetail("Unable to crop the current video frame.");
      return null;
    }
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = getCanvasContext(canvas);
    if (!context) return null;
    context.drawImage(crop, 0, 0);
    setCapturedFrame(canvas.toDataURL("image/jpeg", 0.82));
    return canvas;
  }, []);

  const captureFrame = async () => {
    captureScanRegion();
  };

  const scanCapturedFrame = async (sourceCanvas?: HTMLCanvasElement | null) => {
    const canvas = sourceCanvas ?? canvasRef.current;
    if (!canvas) return;
    try {
      const found = await decodePreparedCanvases(canvas);
      if (!found) setDetail("No barcode detected in captured frame. Try moving closer, reducing glare, or switching scanner engine.");
    } catch (error) {
      setDetail(error instanceof Error ? error.message : "Captured frame scan failed.");
    }
  };

  const captureAndScanFrame = async () => {
    const canvas = captureScanRegion();
    await scanCapturedFrame(canvas);
  };

  const readVinText = useCallback(async () => {
    if (ocrBusyRef.current || acceptedRef.current || pausedRef.current) return;
    const canvas = captureScanRegion();
    if (!canvas) return;
    const runId = ocrRunIdRef.current;
    ocrBusyRef.current = true;
    setOcrStatus("preparing");
    setDetail("Preparing image for OCR...");
    try {
      setOcrStatus("reading");
      setDetail("Reading VIN text...");
      const result = await scanVinTextFromImage(canvas);
      if (runId !== ocrRunIdRef.current || acceptedRef.current) return;
      setLastOcrResult(result);
      setLastExtraction(result.extraction);
      setLastScanned(result.rawText);
      if (result.extraction.isValid && result.extraction.candidate) {
        setOcrStatus("found");
        setSuccessfulEnhancement(result.preprocessing as EnhancementName);
        acceptVin(result.extraction.candidate, result.rawText, "ocr");
        return;
      }
      setOcrStatus("not_found");
      setStatus("scanning");
      setDetail(result.extraction.reason ?? "No VIN text found. Try moving closer or typing the VIN manually.");
    } catch (error) {
      if (runId !== ocrRunIdRef.current) return;
      setOcrStatus("error");
      setDetail(error instanceof Error ? error.message : "OCR VIN text scan failed.");
    } finally {
      if (runId === ocrRunIdRef.current) ocrBusyRef.current = false;
    }
  }, [acceptVin, captureScanRegion]);

  useEffect(() => {
    if (status !== "scanning") return undefined;
    autoOcrDelayRef.current = window.setTimeout(() => {
      void readVinText();
      autoOcrIntervalRef.current = window.setInterval(() => void readVinText(), 3000);
    }, 3000);
    return () => {
      if (autoOcrDelayRef.current) window.clearTimeout(autoOcrDelayRef.current);
      if (autoOcrIntervalRef.current) window.clearInterval(autoOcrIntervalRef.current);
      autoOcrDelayRef.current = null;
      autoOcrIntervalRef.current = null;
    };
  }, [readVinText, status]);

  const testRawBarcode = () => {
    const extraction = extractVinFromScannedText(rawTestValue);
    setRawTestExtraction(extraction);
    setLastScanned(rawTestValue);
    setLastExtraction(extraction);
    setStatus(extraction.isValid ? "scanning" : "invalid");
    setDetail(extraction.isValid ? "Valid VIN candidate found. Use VIN is enabled." : extraction.reason);
  };

  const useRawTestVin = () => {
    const extraction = rawTestExtraction ?? extractVinFromScannedText(rawTestValue);
    setRawTestExtraction(extraction);
    if (extraction.isValid && extraction.candidate) {
      acceptVin(extraction.candidate, rawTestValue, "none");
      return;
    }
    setDetail(extraction.reason ?? "Raw barcode value is not a valid VIN.");
  };

  const handleManualVin = () => {
    const extraction = extractVinFromScannedText(manualVin);
    if (!extraction.isValid || !extraction.candidate) {
      setLastExtraction(extraction);
      setDetail("Manual VIN must be 17 characters and cannot contain I, O, or Q.");
      setStatus("invalid");
      return;
    }
    acceptVin(extraction.candidate, manualVin, "none");
  };

  const friendlyStatus = ocrStatus === "preparing"
    ? "Preparing image..."
    : ocrStatus === "reading"
      ? "Reading VIN text..."
      : status === "found"
        ? "VIN found. Decoding..."
        : statusMessage(status, detail);
  const statusTone = status === "found" ? "text-green-700" : status === "invalid" || status === "denied" || status === "no_camera" || status === "error" ? "text-amber-700" : "text-[var(--pos-muted)]";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Scan VIN Barcode">
      <section className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--pos-border)] px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--pos-blue)]">Camera Scanner</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--pos-text)]">Scan VIN Barcode</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--pos-muted)]">Point the camera at the VIN barcode on the door jamb or windshield label. Manual entry and USB scanners still work.</p>
          </div>
          <Button size="sm" variant="ghost" icon={<X size={20} />} aria-label="Close scanner" onClick={close} />
        </header>

        <div className="overflow-y-auto bg-[var(--pos-bg)] p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr] md:items-end">
                <label className="block text-sm font-semibold text-[var(--pos-text)]">
                  Camera
                  <select
                    className="mt-2 min-h-12 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-white px-3 text-sm font-semibold text-[var(--pos-text)] outline-none focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]"
                    value={selectedDeviceId ?? ""}
                    onChange={(event) => {
                      const nextDevice = event.target.value || undefined;
                      setSelectedDeviceId(nextDevice);
                      void startScanner(nextDevice, engineChoice);
                    }}
                  >
                    {devices.length ? devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{cameraLabel(device, index)}</option>) : <option value="">Default camera</option>}
                  </select>
                </label>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-[var(--pos-border)] bg-slate-950 shadow-inner">
                <video ref={videoRef} className="aspect-video w-full bg-slate-950 object-cover" muted playsInline autoPlay />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[26%] w-[80%] rounded-2xl border-4 border-[var(--pos-blue)] bg-[var(--pos-blue)]/5 shadow-[0_0_0_999px_rgba(2,6,23,0.38)]">
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-4 py-1 text-sm font-black text-white">Align barcode or VIN text inside the box</div>
                    <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/80 px-4 py-1 text-xs font-bold text-white">Hold steady. Avoid glare. Move closer.</div>
                  </div>
                </div>
              </div>

              {showStillLooking ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  No VIN found yet. Hold steady, move closer, reduce glare, or use manual entry.
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setManualVin(lastExtraction?.candidate ?? "")}>Try Manual Entry</Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-4">
                <div className="flex items-start gap-3">
                  {status === "found" ? <CheckCircle2 className="mt-0.5 text-green-600" size={22} /> : scannerActive ? <Camera className="mt-0.5 text-[var(--pos-blue)]" size={22} /> : <AlertCircle className="mt-0.5 text-amber-600" size={22} />}
                  <div>
                    <div className={`font-black ${statusTone}`}>{friendlyStatus}</div>
                    <p className="mt-1 text-sm text-[var(--pos-muted)]">Move closer, reduce glare, try the door jamb sticker, and keep the VIN text inside the box. If the barcode will not scan, the scanner will read the VIN text automatically.</p>
                    {ocrStatus !== "idle" ? <div className="mt-2 text-xs font-black uppercase tracking-wide text-[var(--pos-blue)]">OCR: {ocrStatus.replace("_", " ")}</div> : null}
                    {lastExtraction?.candidate ? <div className="mt-2 text-xs font-semibold text-[var(--pos-muted)]">VIN candidate: {lastExtraction.candidate}</div> : null}
                    {lastExtraction?.reason ? <div className="mt-1 text-xs font-semibold text-amber-700">{lastExtraction.reason}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-[var(--pos-border)] bg-white p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-[var(--pos-blue)]">Manual Fallback</h3>
                <p className="mt-1 text-sm text-[var(--pos-muted)]">Type the VIN here if the barcode will not scan.</p>
                <input
                  className="mt-3 min-h-12 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-white px-3 text-sm font-black uppercase tracking-wide text-[var(--pos-text)] outline-none focus:border-[var(--pos-blue)] focus:ring-4 focus:ring-[var(--pos-blue-soft)]"
                  value={manualVin}
                  onChange={(event) => setManualVin(event.target.value.toUpperCase())}
                  onKeyDown={(event) => { if (event.key === "Enter") handleManualVin(); }}
                  placeholder="17-character VIN"
                />
                <Button className="mt-3 w-full" onClick={handleManualVin}>Use This VIN</Button>
              </div>

              <details className="rounded-2xl border border-[var(--pos-border)] bg-white p-4" open={diagnosticsOpen} onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}>
                <summary className="cursor-pointer text-sm font-black uppercase tracking-wide text-[var(--pos-text)]">Scanner Diagnostics</summary>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[var(--pos-text)] sm:col-span-2">
                    Scanner Engine
                    <select
                      className="mt-2 min-h-11 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-white px-3 text-sm font-semibold text-[var(--pos-text)] outline-none focus:border-[var(--pos-blue)]"
                      value={engineChoice}
                      onChange={(event) => {
                        const nextEngine = event.target.value as ScannerEngine;
                        setEngineChoice(nextEngine);
                        void startScanner(selectedDeviceId, nextEngine);
                      }}
                    >
                      <option value="auto">Auto</option>
                      <option value="native">Native BarcodeDetector</option>
                      <option value="zxing">ZXing</option>
                    </select>
                  </label>
                  <Button size="sm" variant="secondary" icon={<RotateCcw size={16} />} onClick={() => void startScanner()}>Restart Scanner</Button>
                  <Button size="sm" variant="secondary" icon={scannerActive ? <Pause size={16} /> : <Play size={16} />} onClick={togglePaused}>{status === "paused" ? "Resume" : "Pause"}</Button>
                  <Button size="sm" variant="secondary" disabled={!torchAvailable} icon={<Flashlight size={16} />} onClick={() => void toggleTorch()}>{torchOn ? "Torch Off" : "Torch"}</Button>
                  <Button size="sm" variant="secondary" icon={<ScanLine size={16} />} onClick={() => void captureAndScanFrame()}>Capture & Scan Barcode</Button>
                  <Button size="sm" variant="secondary" disabled={ocrStatus === "reading" || ocrStatus === "preparing"} icon={<Camera size={16} />} onClick={() => void readVinText()}>{ocrStatus === "reading" ? "Reading..." : "Read VIN Text"}</Button>
                  <Button size="sm" variant="secondary" icon={<Camera size={16} />} onClick={() => void captureFrame()}>Capture Frame</Button>
                </div>
                {zoomAvailable ? (
                  <label className="mt-4 block text-sm font-semibold text-[var(--pos-text)]">
                    Camera zoom
                    <input
                      className="mt-2 w-full accent-[var(--pos-blue)]"
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step}
                      value={zoomValue}
                      onChange={(event) => void updateZoom(Number(event.target.value))}
                    />
                  </label>
                ) : null}
                <dl className="mt-4 space-y-2 text-xs text-[var(--pos-muted)]">
                  <div className="flex justify-between gap-3"><dt>Permission</dt><dd className="font-bold text-[var(--pos-text)]">{permissionStatus}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Camera</dt><dd className="text-right font-bold text-[var(--pos-text)]">{selectedCamera?.label || "Default / label hidden"}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Video</dt><dd className="font-bold text-[var(--pos-text)]">{videoStatus}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Engine</dt><dd className="font-bold text-[var(--pos-text)]">{activeEngine}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Engine status</dt><dd className="text-right font-bold text-[var(--pos-text)]">{engineStatus}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Attempts</dt><dd className="font-bold text-[var(--pos-text)]">{attempts}</dd></div>
                  <div className="flex justify-between gap-3"><dt>Scan loop</dt><dd className="font-bold text-[var(--pos-text)]">{fps} fps</dd></div>
                  <div><dt>Enhancements tried</dt><dd className="mt-1 font-bold text-[var(--pos-text)]">{attemptedEnhancements.length ? attemptedEnhancements.join(", ") : "-"}</dd></div>
                  <div><dt>Successful enhancement</dt><dd className="mt-1 font-bold text-[var(--pos-text)]">{successfulEnhancement ?? "-"}</dd></div>
                  <div><dt>Formats</dt><dd className="mt-1 font-bold text-[var(--pos-text)]">{formatLabel}</dd></div>
                  <div><dt>Last raw value</dt><dd className="mt-1 break-all font-bold text-[var(--pos-text)]">{lastScanned ?? "-"}</dd></div>
                  <div><dt>Last normalized</dt><dd className="mt-1 break-all font-bold text-[var(--pos-text)]">{lastExtraction?.normalized ?? "-"}</dd></div>
                  <div><dt>Last candidate</dt><dd className="mt-1 break-all font-bold text-[var(--pos-text)]">{lastExtraction?.candidate || "-"}</dd></div>
                  <div><dt>Last validation</dt><dd className="mt-1 font-bold text-[var(--pos-text)]">{lastExtraction?.isValid ? "valid" : lastExtraction?.reason ?? "-"}</dd></div>
                  <div><dt>Last OCR raw text</dt><dd className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all font-bold text-[var(--pos-text)]">{lastOcrResult?.rawText || "-"}</dd></div>
                  <div><dt>Last OCR normalized</dt><dd className="mt-1 break-all font-bold text-[var(--pos-text)]">{lastOcrResult?.normalizedText || "-"}</dd></div>
                  <div><dt>Last OCR VIN candidate</dt><dd className="mt-1 break-all font-bold text-[var(--pos-text)]">{lastOcrResult?.extraction.candidate || "-"}</dd></div>
                  <div><dt>Last OCR validation</dt><dd className="mt-1 font-bold text-[var(--pos-text)]">{lastOcrResult?.extraction.isValid ? "valid" : lastOcrResult?.extraction.reason ?? "-"}</dd></div>
                  <div><dt>OCR preprocessing</dt><dd className="mt-1 font-bold text-[var(--pos-text)]">{lastOcrResult?.preprocessing ?? "-"}</dd></div>
                </dl>
                <div className="mt-4 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-soft)] p-3">
                  <label className="text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">
                    Test Raw Barcode Value
                    <input
                      className="mt-2 min-h-11 w-full rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-white px-3 font-mono text-xs font-bold text-[var(--pos-text)] outline-none focus:border-[var(--pos-blue)]"
                      value={rawTestValue}
                      onChange={(event) => setRawTestValue(event.target.value.toUpperCase())}
                      placeholder="Paste raw barcode text"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={testRawBarcode}>Test Extract VIN</Button>
                    <Button size="sm" disabled={!(rawTestExtraction?.isValid && rawTestExtraction.candidate)} onClick={useRawTestVin}>Use VIN</Button>
                  </div>
                  {rawTestExtraction ? (
                    <div className="mt-2 text-xs font-semibold text-[var(--pos-muted)]">
                      Candidate: <strong>{rawTestExtraction.candidate || "-"}</strong> · {rawTestExtraction.isValid ? "valid" : rawTestExtraction.reason}
                    </div>
                  ) : null}
                </div>
                {capturedFrame ? (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--pos-muted)]">Captured Frame</div>
                    <img src={capturedFrame} alt="Captured camera frame" className="max-h-56 w-full rounded-xl border border-[var(--pos-border)] object-contain" />
                  </div>
                ) : null}
              </details>
            </aside>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-[var(--pos-border)] bg-white px-6 py-4">
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={close}>Enter VIN Manually</Button>
        </footer>
      </section>
    </div>
  );
}
