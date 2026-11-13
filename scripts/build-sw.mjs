// Post-build step: writes out/sw.js with a precache list of every exported file,
// so the whole app — pages, JS, CSS, fonts, icons — works offline after first load.
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
// The OCR engine (public/ocr) is big and optional: it is cached the first time
// someone scans a receipt instead of being downloaded with the app shell.
const SKIP = [/\.map$/, /^sw\.js$/, /^404\/?/, /\.DS_Store$/, /^icons\/app-icon-1024\.png$/, /^ocr\//];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])));
  return files.flat();
}

const files = (await walk(OUT))
  .map((file) => relative(OUT, file).split(sep).join("/"))
  .filter((file) => !SKIP.some((re) => re.test(file)));

const hash = createHash("sha256");
let bytes = 0;
for (const file of files.sort()) {
  const content = await readFile(join(OUT, file));
  hash.update(file).update(content);
  bytes += (await stat(join(OUT, file))).size;
}
const version = hash.digest("hex").slice(0, 12);

// Directory indexes are requested as "/route/"; precache them under that URL.
const urls = files.map((file) => "/" + file.replace(/(^|\/)index\.html$/, "$1"));

const template = await readFile(fileURLToPath(new URL("./sw-template.js", import.meta.url)), "utf8");
const sw = template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(urls));
await writeFile(join(OUT, "sw.js"), sw);
console.log(`✓ sw.js — ${urls.length} files (${(bytes / 1024 / 1024).toFixed(2)} MB), version ${version}`);
