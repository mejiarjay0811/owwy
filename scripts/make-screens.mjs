/**
 * Regenerates the marketing site's phone screenshots from the real app.
 *
 * These were taken by hand once and then drifted: every change to type
 * scale, spacing or layout left the site showing an app that no longer
 * exists. Driving the built app means the pictures are the product, and
 * updating them after a redesign is one command.
 *
 *   npm run build && node scripts/serve.mjs &   (or any static server)
 *   node scripts/make-screens.mjs [--url=http://localhost:4173]
 *
 * Writes into site/assets/screens at the 390x844 the site markup declares,
 * at 2x for retina.
 */
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:4173";
const OUT = "site/assets/screens";

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.emulateTimezone("Asia/Manila");
const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

const shot = async (name) => {
  await hideDemoBanner();
  await settle(150);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
};

const tap = async (label, ms = 1400) => {
  const ok = await page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "") === l);
    b?.click();
    return Boolean(b);
  }, label);
  await settle(ms);
  return ok;
};

// ------------------------------------------------------------------ seed
await page.goto(BASE, { waitUntil: "networkidle2" });
await settle(1600);
if (page.url().includes("/welcome")) {
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"))?.click());
  await settle(4000);
}
for (let i = 0; i < 8 && (await page.$('[role="dialog"][aria-modal="true"]')); i++) {
  await page.keyboard.press("Escape");
  await settle(400);
}
/**
 * Hide the "you're exploring sample data" banner.
 *
 * It's a true and useful thing to say inside the app, but on the marketing
 * site it reads as a caption on the picture rather than part of the product.
 * Re-applied after each navigation, since the stylesheet goes with the page.
 */
const hideDemoBanner = () =>
  page.evaluate(() => {
    if (document.getElementById("shot-style")) return;
    const style = document.createElement("style");
    style.id = "shot-style";
    style.textContent = ".bg-accent-soft:has(> svg.lucide-flask-conical) { display: none !important; }";
    document.head.append(style);
  });

/**
 * Turn the Grove on for the shots.
 *
 * It is off by default on a phone now, because it fills the screen — but it
 * is the app's signature view and one tap away in Customize home, so the
 * site should show it. This is a real state of the real app, not a mock-up.
 */
await page.evaluate(async () => {
  const db = await new Promise((res) => {
    const r = indexedDB.open("owwy");
    r.onsuccess = () => res(r.result);
  });
  const store = db.transaction("settings", "readwrite").objectStore("settings");
  const current = await new Promise((res) => {
    const q = store.get("app");
    q.onsuccess = () => res(q.result);
  });
  store.put({ ...current, dashboard: current.dashboard.map((w) => (w.id === "grove" ? { ...w, visible: true } : w)) });
});
await settle(600);

console.log("screens:");

// --------------------------------------------------------------- simple pages
for (const [route, name, scrollTo] of [
  ["/", "home-grove", 0],
  ["/safe-to-spend/", "safe-to-spend", 0],
  ["/accounts/", "wallet", 0],
  ["/budgets/", "budgets", 120],
  ["/shopping/", "shopping", 0],
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
  await settle(1800);
  if (scrollTo) await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
  await settle(700);
  await shot(name);
}

// ------------------------------------------------------- stats, on the trend
await page.goto(`${BASE}/insights/`, { waitUntil: "networkidle2" });
await settle(1800);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[role="radio"]')].find((x) => (x.textContent || "").trim() === "Trend");
  b?.click();
});
await settle(1400);
await shot("stats-trend");

// --------------------------------------------------------- Ask, with an answer
await page.goto(`${BASE}/ask/`, { waitUntil: "networkidle2" });
await settle(1600);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Where did my money go"));
  b?.click();
});
await page.waitForFunction(() => !document.body.innerText.includes("Thinking…"), { timeout: 30000, polling: 500 }).catch(() => {});
await settle(1600);
await shot("ask-answer");

// ------------------------------------------------- a real scan, really read
await page.goto(`${BASE}/transactions/`, { waitUntil: "networkidle2" });
await settle(1400);
await tap("Add transaction");
await tap("Scan a receipt");

// Drawn here rather than shipped as a fixture: a photo of a real receipt
// would put someone's actual purchases on the marketing site.
const RECEIPT = [
  ["PUREGOLD", 34],
  ["Mandaluyong", 22],
  ["", 16],
  ["Rice 5kg            285.00", 24],
  ["Eggs tray            210.00", 24],
  ["Cooking oil 1L       165.00", 24],
  ["Coffee 3-in-1        139.00", 24],
  ["Detergent            118.00", 24],
  ["", 16],
  ["SUBTOTAL             917.00", 24],
  ["VAT INCLUDED          98.25", 24],
  ["TOTAL                917.00", 30],
  ["CASH               1,000.00", 24],
  ["CHANGE                83.00", 24],
];
await page.evaluate(async (lines) => {
  const c = document.createElement("canvas");
  c.width = 780;
  c.height = 120 + lines.length * 46;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#111";
  let y = 70;
  for (const [text, size] of lines) {
    g.font = `${size}px monospace`;
    g.fillText(text, 50, y);
    y += size + 20;
  }
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "receipt.png", { type: "image/png" }));
  const dialog = [...document.querySelectorAll("[role=dialog]")].pop();
  const input = dialog.querySelectorAll('input[type="file"]')[1];
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}, RECEIPT);

const read = await page
  .waitForFunction(() => document.body.innerText.includes("Shop or note"), { timeout: 120000, polling: 600 })
  .then(() => true)
  .catch(() => false);
await settle(1400);
if (read) await shot("scan-review");
else console.log("  scan-review.png SKIPPED — the receipt never finished reading; existing file kept");

await browser.close();
console.log(read ? "\nall screens regenerated" : "\nregenerated, except scan-review");
process.exit(read ? 0 : 1);
