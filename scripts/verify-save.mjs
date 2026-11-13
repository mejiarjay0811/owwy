/**
 * End-to-end: the two new fields have to survive the schema, the repository
 * and a reload — a form that renders is not a feature that saves.
 */
import puppeteer from "puppeteer";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:4173";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852 });
await page.emulateTimezone("Asia/Manila");
const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
};
const clickText = (text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a")].find((x) => (x.textContent || "").trim() === t);
    el?.click();
    return Boolean(el);
  }, text);

page.on("pageerror", (e) => {
  console.log(`FAIL  uncaught page error — ${String(e).slice(0, 160)}`);
  failures++;
});

await page.goto(BASE, { waitUntil: "networkidle2" });
await settle(1500);
if (page.url().includes("/welcome")) {
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"))?.click());
  await settle(3500);
}
for (let i = 0; i < 8 && (await page.$('[role="dialog"][aria-modal="true"]')); i++) {
  await page.keyboard.press("Escape");
  await settle(400);
}

// ------------------------------------------- an automation on 15th and 30th
await page.goto(`${BASE}/recurring/`, { waitUntil: "networkidle2" });
await settle(1200);
await clickText("New");
await settle(1000);
await page.evaluate(() => {
  const name = [...document.querySelectorAll("input")].find((i) => (i.placeholder || "").includes("Salary"));
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(name, "Payday");
  name.dispatchEvent(new Event("input", { bubbles: true }));
  const amount = document.querySelector('input[inputmode="decimal"]');
  set.call(amount, "15000");
  amount.dispatchEvent(new Event("input", { bubbles: true }));
  const freq = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "monthDays"));
  freq.value = "monthDays";
  freq.dispatchEvent(new Event("change", { bubbles: true }));
});
await settle(700);
// Category is required for income.
await page.evaluate(() => {
  const cat = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.textContent.includes("Salary")));
  if (cat) {
    cat.value = [...cat.options].find((o) => o.textContent.includes("Salary")).value;
    cat.dispatchEvent(new Event("change", { bubbles: true }));
  }
});
await settle(400);
await clickText("Save");
await settle(2000);

await page.reload({ waitUntil: "networkidle2" });
await settle(2000);
const saved = await page.evaluate(() => {
  const text = document.body.innerText;
  return { present: text.includes("Payday"), schedule: /Monthly on ([^·]+)·/.exec(text)?.[1]?.trim() ?? null };
});
check(saved.present, "the automation saved");
check(saved.schedule === "the 15th and the 30th", "its chosen days survived a reload", saved.schedule ?? "not shown");

// ------------------------------------------------- a budget with a label
await page.goto(`${BASE}/budgets/`, { waitUntil: "networkidle2" });
await settle(1400);
await clickText("Budget");
await settle(1200);
const picked = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll('button[aria-pressed]')];
  const other = tiles.find((b) => /other/i.test(b.textContent || "")) ?? tiles.at(-1);
  other?.click();
  return other?.textContent?.trim() ?? null;
});
await settle(600);
await page.evaluate(() => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const amount = document.querySelector('input[inputmode="decimal"]');
  set.call(amount, "4000");
  amount.dispatchEvent(new Event("input", { bubbles: true }));
  const label = [...document.querySelectorAll("input")].find((i) => (i.placeholder || "").startsWith("e.g."));
  set.call(label, "Pet supplies");
  label.dispatchEvent(new Event("input", { bubbles: true }));
});
await settle(500);
await clickText("Save budget");
await settle(2000);

await page.reload({ waitUntil: "networkidle2" });
await settle(2000);
const budget = await page.evaluate(() => {
  const text = document.body.innerText;
  return { label: text.includes("Pet supplies"), category: /Pet supplies\s*\n\s*in ([^\n]+)/.exec(text)?.[1] ?? null };
});
check(budget.label, `the budget label saved (category: ${picked})`);
check(Boolean(budget.category), "the category still shows underneath it", budget.category ?? "not shown");

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
