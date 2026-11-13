/**
 * Production readiness audit.
 *
 * Drives the real built app in a real browser across every route and every
 * device width we claim to support, and reports what it measures rather than
 * what the markup promises:
 *
 *   - console errors and uncaught rejections
 *   - horizontal overflow, and which element causes it
 *   - interactive controls below the 44px touch target minimum
 *   - controls with no accessible name
 *   - images with no alt text
 *   - heading structure (missing h1, skipped levels)
 *   - document title and meta description
 *
 *   node scripts/audit.mjs [--url=http://localhost:4173] [--json=audit.json]
 */
import { writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback}`).split("=").slice(1).join("=");
const URL_BASE = arg("url", "http://localhost:4173");
const JSON_OUT = arg("json", "");

const ROUTES = [
  "/", "/welcome/", "/accounts/", "/transactions/", "/insights/", "/budgets/", "/goals/",
  "/bills/", "/recurring/", "/calendar/", "/debts/", "/owed/", "/shopping/", "/ask/",
  "/afford/", "/safe-to-spend/", "/notes/", "/report/", "/review/", "/settings/",
  "/premium/", "/more/", "/about/", "/privacy/", "/terms/", "/support/",
];

/** The widths the product claims to support, smallest first. */
const VIEWPORTS = [
  { name: "320 small", width: 320, height: 568 },
  { name: "360 android", width: 360, height: 740 },
  { name: "375 iPhone SE", width: 375, height: 667 },
  { name: "393 Pixel", width: 393, height: 852 },
  { name: "430 iPhone Max", width: 430, height: 932 },
  { name: "768 tablet", width: 768, height: 1024 },
  { name: "834 iPad", width: 834, height: 1112 },
  { name: "1024 small laptop", width: 1024, height: 768 },
  { name: "1280 laptop", width: 1280, height: 800 },
  { name: "1440 desktop", width: 1440, height: 900 },
  { name: "1920 desktop", width: 1920, height: 1080 },
];

const MIN_TAP = 44;

/** Runs in the page. Measures the live layout, not the source. */
function inspect(minTap) {
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const accName = (el) =>
    (el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent) ||
      el.textContent ||
      el.querySelector("img[alt]")?.getAttribute("alt") ||
      "").trim();

  const doc = document.documentElement;
  const overflow = doc.scrollWidth - doc.clientWidth;

  // Which elements actually stick out past the right edge.
  const offenders = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1 && r.width <= doc.clientWidth * 2) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 90),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
  }

  const interactive = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="radio"], [role="tab"], [role="menuitem"]')].filter(visible);

  const smallTaps = [];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    // Skip-links and other focus-only affordances measure 1px until focused;
    // counting them as tap targets is noise, not a finding.
    if (r.width <= 2 || r.height <= 2 || el.getAttribute("type") === "hidden") continue;
    if (Math.min(r.width, r.height) < minTap) {
      smallTaps.push({ tag: el.tagName.toLowerCase(), name: accName(el).slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  const imgs = [...document.querySelectorAll("img")].filter(visible).filter((i) => i.getAttribute("alt") === null);

  const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((h) => Number(h.tagName[1]));
  const headingIssues = [];
  if (!levels.includes(1)) headingIssues.push("no h1");
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) headingIssues.push(`h${levels[i - 1]} → h${levels[i]}`);

  return {
    overflow: Math.max(0, overflow),
    offenders: offenders.slice(0, 5),
    smallTaps: smallTaps.slice(0, 8),
    smallTapCount: smallTaps.length,
    imgNoAlt: imgs.length,
    headingIssues: [...new Set(headingIssues)],
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
  };
}

const report = { url: URL_BASE, at: new Date().toISOString(), routes: [], totals: {} };

const browser = await puppeteer.launch({ headless: true, args: ["--hide-scrollbars=false", "--font-render-hinting=none"] });
const page = await browser.newPage();
await page.emulateTimezone("Asia/Manila");

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 240));
});
page.on("pageerror", (e) => consoleErrors.push(`UNCAUGHT: ${String(e).slice(0, 240)}`));

const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

// Seed the app's own sample data once, so screens have real content to lay out.
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(URL_BASE, { waitUntil: "networkidle2" });
await settle(1500);
if (page.url().includes("/welcome")) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"));
    if (b) b.click();
  });
  await settle(3500);
  console.log("seeded sample data");
}

// The first-run coach marks lock body scroll and dim the page; dismiss them so
// the audit measures the app rather than the overlay.
await page.evaluate(() => {
  const skip = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Skip");
  if (skip) skip.click();
});
await settle(1200);

for (const route of ROUTES) {
  const entry = { route, viewports: [], console: [] };
  consoleErrors.length = 0;

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  try {
    await page.goto(`${URL_BASE}${route}`, { waitUntil: "networkidle2", timeout: 30000 });
  } catch (e) {
    entry.error = String(e).slice(0, 160);
    report.routes.push(entry);
    console.log(`${route.padEnd(18)} LOAD FAILED`);
    continue;
  }
  await settle(900);

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await settle(260);
    const r = await page.evaluate(inspect, MIN_TAP);
    entry.viewports.push({ ...vp, ...r });
  }
  // Accessible names come from Chrome's own accessibility tree rather than a
  // hand-rolled guess — `<label for>`, aria-labelledby and implicit naming are
  // easy to get wrong, and a false "unnamed control" is worse than no check.
  const tree = await page.accessibility.snapshot({ interestingOnly: false });
  const unnamed = [];
  (function walk(node) {
    if (!node) return;
    const NAMED = ["button", "link", "switch", "checkbox", "textbox", "combobox", "radio", "menuitem", "tab"];
    if (NAMED.includes(node.role) && !(node.name ?? "").trim()) unnamed.push(node.role);
    (node.children ?? []).forEach(walk);
  })(tree);
  entry.unnamed = unnamed;

  entry.console = [...new Set(consoleErrors)];
  report.routes.push(entry);

  const worstOverflow = Math.max(...entry.viewports.map((v) => v.overflow));
  const taps = Math.max(...entry.viewports.map((v) => v.smallTapCount));
  const flags = [
    worstOverflow > 1 ? `overflow ${worstOverflow}px` : "",
    taps ? `${taps} small taps` : "",
    entry.unnamed.length ? `${entry.unnamed.length} unnamed controls` : "",
    entry.viewports[0].imgNoAlt ? `${entry.viewports[0].imgNoAlt} img no-alt` : "",
    entry.viewports[0].headingIssues.length ? entry.viewports[0].headingIssues.join(",") : "",
    entry.console.length ? `${entry.console.length} console errors` : "",
  ].filter(Boolean);
  console.log(`${route.padEnd(18)} ${flags.length ? flags.join(" · ") : "clean"}`);
}

await browser.close();

report.totals = {
  routes: report.routes.length,
  routesWithOverflow: report.routes.filter((r) => r.viewports?.some((v) => v.overflow > 1)).length,
  routesWithConsoleErrors: report.routes.filter((r) => r.console?.length).length,
  routesMissingH1: report.routes.filter((r) => r.viewports?.[0]?.headingIssues.includes("no h1")).length,
  routesMissingDescription: report.routes.filter((r) => !r.viewports?.[0]?.description).length,
  routesWithUnnamedControls: report.routes.filter((r) => r.unnamed?.length).length,
  worstTapTarget: Math.min(
    ...report.routes.flatMap((r) => r.viewports?.flatMap((v) => v.smallTaps.map((t) => Math.min(t.w, t.h))) ?? [Infinity]),
  ),
};
console.log("\n", report.totals);
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(report, null, 2));
