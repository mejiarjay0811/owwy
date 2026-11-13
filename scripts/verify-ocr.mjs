/**
 * End-to-end check that on-device receipt reading still works: drives the real
 * scan sheet with a generated receipt and asserts the total Owwy reads.
 *
 *   node scripts/verify-ocr.mjs [--url=http://localhost:4173]
 */
import puppeteer from "puppeteer";

const BASE = (process.argv.find((a) => a.startsWith("--url=")) ?? "--url=http://localhost:4173").slice(6);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Receipt text, and the total a correct read must produce. */
const CASES = [
  {
    name: "subtotal vs total vs cash",
    expect: "319",
    lines: [
      ["JOLLIBEE", 34], ["SM Megamall Branch", 22], ["09/24/2026   18:42", 22],
      ["1 Chickenjoy Solo      99.00", 24], ["1 Jolly Spaghetti      75.00", 24],
      ["2 Peach Mango Pie      90.00", 24], ["1 Iced Tea             55.00", 24],
      ["SUBTOTAL              284.82", 24], ["VAT 12%                34.18", 24],
      ["TOTAL                 319.00", 26], ["CASH                  500.00", 24],
      ["CHANGE                181.00", 24],
    ],
  },
  {
    name: "quantity beside price, trailing summary lines",
    expect: "741.72",
    lines: [
      ["PUREGOLD PRICE CLUB", 32], ["Ayala Ave cor Buendia", 22], ["09/24/2026   14:32", 22],
      ["Rice 5kg               289.00", 24], ["Eggs tray              210.50", 24],
      ["Dishwashing soap  2     64.00", 24], ["SUBTOTAL               662.25", 24],
      ["VAT 12%                 79.47", 24], ["TOTAL                  741.72", 26],
      ["CASH                 1,000.00", 24], ["TOTAL ITEMS                 5", 24],
      ["TOTAL SAVINGS          120.00", 24],
    ],
  },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  const t = m.text();
  if (/Content Security Policy|Refused to/i.test(t)) errors.push(t.slice(0, 180));
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 160)));

await page.setViewport({ width: 393, height: 852 });
await page.goto(BASE, { waitUntil: "networkidle2" });
await wait(2500);
if (page.url().includes("/welcome")) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"));
    if (b) b.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes("Your money"), { timeout: 60000, polling: 500 }).catch(() => {});
  await wait(1500);
}
// Dismiss the first-run tour if it is up.
await page.evaluate(() => {
  const skip = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Skip the tour"));
  if (skip) skip.click();
});
await wait(1200);

const tap = async (label) => {
  const ok = await page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "") === l);
    if (b) b.click();
    return Boolean(b);
  }, label);
  await wait(1400);
  return ok;
};

let pass = 0;
for (const testCase of CASES) {
  await page.goto(`${BASE}/transactions/`, { waitUntil: "networkidle2" });
  await wait(1200);
  if (!(await tap("Add transaction"))) throw new Error("Add transaction button not found");
  if (!(await tap("Scan a receipt"))) throw new Error("Scan a receipt button not found");

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
  }, testCase.lines);

  await page.waitForFunction(() => document.body.innerText.includes("Shop or note"), { timeout: 90000, polling: 600 }).catch(() => {});
  await wait(1200);

  const read = await page.evaluate(() => {
    const i = [...document.querySelectorAll("input")].find((x) => x.value && /^[0-9,.]+$/.test(x.value));
    return i ? i.value.replace(/,/g, "") : "(none)";
  });
  const ok = read === testCase.expect;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name}: read ${read}, expected ${testCase.expect}`);
  await page.keyboard.press("Escape");
  await wait(600);
}

console.log(`\n${pass}/${CASES.length} receipts read correctly`);
console.log(errors.length ? `CSP/errors:\n${[...new Set(errors)].join("\n")}` : "no CSP violations, no page errors");
await browser.close();
process.exit(pass === CASES.length ? 0 : 1);
