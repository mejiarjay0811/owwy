/**
 * Captures the real Owwy app for the launch video.
 *
 * Nothing here is mocked: it starts the actual build, loads the app's own
 * sample data, drives real taps, and saves what the app renders at 3x pixel
 * density. The video composition only ever shows these pixels.
 *
 *   node capture.mjs [--url http://localhost:4173]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const root = dirname(fileURLToPath(import.meta.url));
const OUT = join(root, "public", "screens");
const url = (process.argv.find((a) => a.startsWith("--url=")) ?? "--url=http://localhost:3000").slice(6);

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const shots = [];

async function shot(page, name, { fullPage = false } = {}) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage, captureBeyondViewport: fullPage });
  const size = fullPage ? await page.evaluate(() => document.documentElement.scrollHeight) : VIEWPORT.height;
  shots.push({ name, fullPage, cssHeight: size });
  console.log(`  ${name}${fullPage ? " (full page)" : ""}`);
}

const settle = (page, ms = 900) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

/** Clicks the first element whose text matches, the way a person would. */
async function tap(page, text, { selector = "button, a, [role=radio], [role=menuitem]", exact = false, nth = 0 } = {}) {
  const found = await page.evaluate(
    ({ text, selector, exact, nth }) => {
      const matches = [...document.querySelectorAll(selector)].filter((el) => {
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
        return exact ? label === text : label.includes(text);
      });
      const el = matches[nth];
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    },
    { text, selector, exact, nth },
  );
  if (!found) throw new Error(`Nothing to tap for "${text}"`);
  await settle(page);
}

/** Escapes any open sheet so a screen is never captured with a leftover dialog. */
async function closeSheets(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => document.querySelectorAll("[role=dialog]").length > 0);
    if (!open) return;
    await page.keyboard.press("Escape");
    await settle(page, 500);
  }
}

const waitForText = (page, text) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 45_000, polling: 400 }, text);

/**
 * Hides the demo-mode banner. It only exists because these captures run on the
 * app's sample data; someone using Owwy with their own money never sees it.
 * The screens, numbers and layout are otherwise untouched.
 */
const hideDemoBanner = (page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('[class*="border-accent/40"]')) {
      if (el.textContent?.includes("sample data")) el.remove();
    }
  });

async function goto(page, path) {
  await page.goto(`${url}${path}`, { waitUntil: "networkidle2" });
  await settle(page, 1400);
  await closeSheets(page);
  await hideDemoBanner(page);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, defaultViewport: VIEWPORT, args: ["--force-device-scale-factor=3", "--hide-scrollbars", "--font-render-hinting=none"] });
  const page = await browser.newPage();
  await page.emulateTimezone("Asia/Manila");

  console.log(`Capturing ${url} …`);
  await page.goto(url, { waitUntil: "networkidle2" });
  await settle(page, 1200);

  // The app's own sample data — never anyone's real finances.
  if (page.url().includes("/welcome")) {
    await tap(page, "Explore with sample data");
    await waitForText(page, "Safe to spend").catch(() => {});
    await settle(page, 2500);
  }

  // ── Scene 2: home, the Grove.
  // Real scroll positions rather than one tall image, so the floating nav and
  // every sticky element sit exactly where the app puts them.
  await goto(page, "/");
  await shot(page, "home-grove");
  for (const [i, y] of [900, 1750].entries()) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await settle(page, 700);
    await shot(page, `home-scroll-${i + 1}`);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page, 600);

  // Reminders: a real bell with real counts
  await tap(page, "Reminders");
  await shot(page, "home-reminders");
  await page.keyboard.press("Escape");
  await settle(page);

  // ── Wallet
  await goto(page, "/accounts/");
  await shot(page, "wallet");
  await tap(page, "actions");
  await shot(page, "wallet-menu");
  await page.keyboard.press("Escape");
  await settle(page);
  await tap(page, "open details");
  await shot(page, "wallet-detail");
  await page.keyboard.press("Escape");
  await settle(page);

  // ── Log + search
  await goto(page, "/transactions/");
  await shot(page, "log");
  await page.click('input[type="search"], input[placeholder*="coffee"], input[aria-label*="Search"]');
  await page.keyboard.type("food over 500", { delay: 55 });
  await settle(page, 1200);
  await shot(page, "log-search");

  // ── Stats
  await goto(page, "/insights/");
  await shot(page, "stats-month");
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" }));
  await settle(page, 700);
  await shot(page, "stats-scrolled");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await settle(page, 500);
  await tap(page, "Trend", { selector: "[role=radio]" });
  await shot(page, "stats-trend");
  await tap(page, "Ahead", { selector: "[role=radio]" });
  await shot(page, "stats-ahead");

  // ── Budgets & goals
  await goto(page, "/budgets/");
  await shot(page, "budgets");
  await goto(page, "/goals/");
  await shot(page, "goals");
  await goto(page, "/safe-to-spend/");
  await shot(page, "safe-to-spend");

  // ── Ask Owwy, answered on device
  await goto(page, "/ask/");
  await shot(page, "ask-empty");
  // Click the composer first: typing without focus would trigger the app's
  // "N" shortcut and open the add-transaction sheet instead.
  await page.click('input[placeholder^="Ask about"]');
  await page.keyboard.type("Where did my money go last month?", { delay: 35 });
  await settle(page, 400);
  const question = await page.$eval('input[placeholder^="Ask about"]', (el) => el.value);
  if (!question) throw new Error("The Ask composer never received the question");
  await shot(page, "ask-typed");
  await page.evaluate(() => {
    const send = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "") === "Send");
    if (send) send.click();
  });
  await waitForText(page, "Ran a query").catch(() => {});
  await settle(page, 2200);
  await shot(page, "ask-answer");

  // ── Add a transaction: calculator and receipt scanning
  await goto(page, "/transactions/");
  await tap(page, "Add transaction");
  await shot(page, "add-empty");
  await tap(page, "Show calculator");
  await page.evaluate(async () => {
    const group = document.querySelector('[aria-label="Calculator"]');
    const press = (l) => [...group.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === l)?.click();
    for (const key of ["1", "2", "0", "Plus", "4", "5", "Multiply", "2"]) {
      press(key);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await settle(page, 700);
  await shot(page, "add-calculator");

  // Receipt scanning, running the real on-device OCR
  await tap(page, "Scan a receipt");
  await shot(page, "scan-intro");
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 760;
    c.height = 860;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#111";
    const lines = [
      ["JOLLIBEE", 36, "bold"], ["SM Megamall Branch", 22, ""], ["TIN 005-123-456-000", 20, ""], ["OFFICIAL RECEIPT", 22, ""], ["", 18, ""],
      ["09/24/2026   18:42", 22, ""], ["", 18, ""], ["1 Chickenjoy Solo        99.00", 24, ""], ["1 Jolly Spaghetti        75.00", 24, ""],
      ["2 Peach Mango Pie        90.00", 24, ""], ["1 Iced Tea               55.00", 24, ""], ["", 18, ""], ["SUBTOTAL                319.00", 24, ""],
      ["VAT 12%                  38.28", 24, ""], ["TOTAL                   319.00", 26, "bold"], ["CASH                    500.00", 24, ""],
      ["CHANGE                  181.00", 24, ""],
    ];
    let y = 70;
    for (const [t, size, weight] of lines) {
      g.font = `${weight} ${size}px "Courier New", monospace`;
      g.fillText(t, 55, y);
      y += size + 18;
    }
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "receipt.png", { type: "image/png" }));
    const dialog = [...document.querySelectorAll("[role=dialog]")].pop();
    const input = dialog.querySelectorAll('input[type="file"]')[1];
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle(page, 1500);
  await shot(page, "scan-reading");
  await waitForText(page, "Shop or note").catch(() => {});
  await settle(page, 900);
  await shot(page, "scan-review");

  // ── The newer chapters of the app: a shopping trip, money owed, installments.
  await closeSheets(page);
  for (const [path, name] of [
    ["/shopping/", "shopping"],
    ["/owed/", "owed"],
    ["/debts/", "debts"],
  ]) {
    await goto(page, path);
    await shot(page, name);
  }

  await writeFile(join(OUT, "manifest.json"), JSON.stringify({ capturedAt: new Date().toISOString(), viewport: VIEWPORT, source: url, shots }, null, 2));
  console.log(`\n${shots.length} screens saved to public/screens`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
