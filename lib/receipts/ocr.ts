import type { Worker as TesseractWorker } from "tesseract.js";

/**
 * Reading receipts happens entirely on the device: the OCR engine is served
 * from Owwy's own files (public/ocr), so no photo ever leaves the phone and
 * scanning keeps working offline.
 */

export interface ScanProgress {
  /** "Getting ready", "Reading the receipt", … */
  label: string;
  /** 0–1 */
  progress: number;
}

const WORKER_PATH = "/ocr/worker.min.js";
const LANG_PATH = "/ocr";
const IDLE_MS = 60_000;

let workerPromise: Promise<TesseractWorker> | null = null;
let idleTimer: number | undefined;

/** OCR needs WebAssembly and workers; every current browser has both. */
export function scanningSupported(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly === "object";
}

/** SIMD builds are much faster; the plain build is the fallback for older devices. */
function supportsSimd(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]),
    );
  } catch {
    return false;
  }
}

function label(status: string): string {
  if (status.includes("loading tesseract") || status.includes("initializing tesseract")) return "Warming up the reader";
  if (status.includes("loading language") || status.includes("initializing api") || status.includes("initialized api")) return "Getting ready";
  if (status.includes("recognizing")) return "Reading the receipt";
  return "Working on it";
}

async function getWorker(onProgress?: (progress: ScanProgress) => void): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: WORKER_PATH,
        langPath: LANG_PATH,
        corePath: supportsSimd() ? "/ocr/tesseract-core-simd-lstm.wasm.js" : "/ocr/tesseract-core-lstm.wasm.js",
        gzip: true,
        // The engine is already cached by the service worker; no second copy needed.
        cacheMethod: "none",
        logger: (message: { status: string; progress: number }) => onProgress?.({ label: label(message.status), progress: message.progress }),
      });
      await worker.setParameters({
        // A receipt is one column of text. Left to decide for itself, the engine
        // treats a tilted photo's right-hand prices as a separate region and
        // drops them — which loses every amount on the receipt.
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        // Keep the wide gaps that separate an item from its price.
        preserve_interword_spaces: "1",
        // Photos carry no DPI; guessing it wrong costs accuracy.
        user_defined_dpi: "300",
      });
      return worker;
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/** Frees the engine's memory once you've stopped scanning. */
export async function releaseScanner(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Already gone.
  }
}

function scheduleRelease() {
  if (typeof window === "undefined") return;
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => void releaseScanner(), IDLE_MS);
}

const MAX_EDGE = 1800;

/**
 * Photos of receipts read far better in grayscale with the contrast pushed:
 * thermal paper is low contrast and phone cameras add noise.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    gray[p] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }
  // Stretch contrast between the darkest and lightest tones, ignoring a few
  // stray pixels. The cut stays small: on a white receipt the ink is only a
  // few percent of the image, and a bigger cut would erase the text.
  const histogram = new Array<number>(256).fill(0);
  for (const value of gray) histogram[value]++;
  const cut = Math.floor(gray.length * 0.002);
  let low = 0;
  let high = 255;
  for (let sum = 0, i = 0; i < 256; i++) {
    sum += histogram[i];
    if (sum > cut) {
      low = i;
      break;
    }
  }
  for (let sum = 0, i = 255; i >= 0; i--) {
    sum += histogram[i];
    if (sum > cut) {
      high = i;
      break;
    }
  }
  // Too narrow a range means the photo is nearly flat; stretching it would
  // wipe out the text, so keep the plain grayscale version instead.
  const range = high - low;
  const stretch = range >= 32;
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const value = stretch ? Math.max(0, Math.min(255, ((gray[p] - low) / range) * 255)) : gray[p];
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ?? file;
}

/** Runs OCR on a receipt photo and returns the raw text. */
export async function readReceiptText(file: Blob, onProgress?: (progress: ScanProgress) => void): Promise<string> {
  if (!scanningSupported()) throw new Error("This device can't scan receipts.");
  onProgress?.({ label: "Getting ready", progress: 0 });
  const prepared = await prepareImage(file);
  const worker = await getWorker(onProgress);
  try {
    const result = await worker.recognize(prepared);
    return result.data.text ?? "";
  } finally {
    scheduleRelease();
  }
}
