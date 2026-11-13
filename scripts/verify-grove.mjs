/**
 * The Grove starts off on a phone and on everywhere else — and turning it
 * off must not take the composer with it.
 */
import puppeteer from "puppeteer";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:4173";
const browser = await puppeteer.launch({ headless: true });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
};

/** A clean install at a given size, seeded with the sample data. */
async function freshAt(width, height) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height });
  await page.emulateTimezone("Asia/Manila");
  const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
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
  return { page, context, settle };
}

const homeState = (page) =>
  page.evaluate(() => ({
    grove: Boolean(document.querySelector('[data-tour="grove"]')),
    composer: Boolean(document.querySelector('[data-tour="composer"]')),
    greeting: Boolean(document.querySelector("h1")),
    customize: [...document.querySelectorAll("button")].some((b) => /Customize home/.test(b.textContent || "")),
    firstScreenful: Math.round(document.querySelector("main")?.firstElementChild?.getBoundingClientRect().height ?? 0),
  }));

// ------------------------------------------------------------------ phone
{
  const { page, context } = await freshAt(393, 852);
  const state = await homeState(page);
  check(!state.grove, "a phone starts without the Grove");
  check(state.composer, "but keeps the composer, so logging is still one tap");
  check(state.greeting, "and still has a greeting header");
  check(state.customize, "with Customize home to turn it on");
  await context.close();
}

// ----------------------------------------------------------------- desktop
{
  const { page, context } = await freshAt(1440, 900);
  const state = await homeState(page);
  check(state.grove, "a desktop still gets the Grove");
  check(state.composer, "with the composer inside it");
  await context.close();
}

// -------------------------------------- an existing phone install is moved
{
  const { page, context, settle } = await freshAt(393, 852);
  // Put it back the way a pre-v4 install looked: Grove on, old version.
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
    store.put({
      ...current,
      schemaVersion: 3,
      dashboard: current.dashboard.map((w) => (w.id === "grove" ? { ...w, visible: true } : w)),
    });
  });
  await page.reload({ waitUntil: "networkidle2" });
  await settle(2500);
  check(!(await homeState(page)).grove, "an install that predates the change is moved across");

  // Turn it back on and make sure the change doesn't undo that next launch.
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Customize home/.test(b.textContent || ""))?.click());
  await settle(1200);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("label")].find((l) => /The Grove/.test(l.textContent || ""));
    const toggle = row?.closest("div")?.parentElement?.querySelector('[role="switch"]');
    toggle?.click();
  });
  await settle(1200);
  await page.keyboard.press("Escape");
  await settle(600);
  const turnedOn = (await homeState(page)).grove;
  await page.reload({ waitUntil: "networkidle2" });
  await settle(2500);
  check(turnedOn && (await homeState(page)).grove, "and turning it back on survives a reload", turnedOn ? "" : "could not turn it on");
  await context.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
