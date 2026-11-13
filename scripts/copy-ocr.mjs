// Copies the offline OCR engine into public/ocr so receipt scanning never calls a CDN.
// These files are downloaded by the browser only the first time someone scans a receipt.
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = join(root, "public", "ocr");

const ASSETS = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  // LSTM-only cores: smaller than the full builds and all Owwy needs.
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];

await mkdir(target, { recursive: true });
let bytes = 0;
for (const [from, to] of ASSETS) {
  const source = join(root, from);
  const destination = join(target, to);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  bytes += (await stat(destination)).size;
}
console.log(`ok ocr assets - ${ASSETS.length} files (${(bytes / 1024 / 1024).toFixed(1)} MB) in public/ocr`);
