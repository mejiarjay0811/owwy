/**
 * The five things asked for this round:
 *   - Ask Owwy takes a key from any AI service, and says so
 *   - the tour teaches Customize home
 *   - back from Settings returns to where you were on More
 *   - icon pickers are a grid, not a sideways scroll
 *   - and there are far more icons to pick from
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

await page.goto(BASE, { waitUntil: "networkidle2" });
await settle(1500);
if (page.url().includes("/welcome")) {
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"))?.click());
  await settle(3500);
}

// ------------------------------------------- the tour teaches Customize home
const steps = [];
for (let i = 0; i < 10; i++) {
  const step = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!d) return null;
    const hole = [...d.querySelectorAll("div")].find((x) => (x.style.boxShadow || "").includes("9999px"));
    const r = hole?.getBoundingClientRect();
    return { title: d.querySelector("h2")?.textContent ?? "", lit: Boolean(r && r.width > 2) };
  });
  if (!step) break;
  steps.push(step);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /^(Next|Start)$/.test((x.textContent || "").trim()));
    b?.click();
  });
  await settle(700);
}
const customize = steps.find((s) => /make this screen yours/i.test(s.title));
check(Boolean(customize), "the tour teaches Customize home", `${steps.length} steps`);
check(Boolean(customize?.lit), "and points at the real button", customize?.lit ? "spotlit" : "no spotlight");

for (let i = 0; i < 8 && (await page.$('[role="dialog"][aria-modal="true"]')); i++) {
  await page.keyboard.press("Escape");
  await settle(400);
}

// ------------------------------------------------ Ask Owwy: any AI service
await page.goto(`${BASE}/ask/`, { waitUntil: "networkidle2" });
await settle(1200);
const askCopy = await page.evaluate(() => document.body.innerText);
check(!/Claude API/i.test(askCopy), "the Ask screen doesn't name one vendor's API");

// Open the settings sheet from the mode chip under the title.
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^On device$/.test((x.textContent || "").trim()));
  b?.click();
});
await settle(1200);
// Switch to bring-your-own-AI so the provider fields appear.
await page.evaluate(() => {
  const card = [...document.querySelectorAll('[role="radio"]')].find((x) => /your own AI/i.test(x.textContent || ""));
  card?.click();
});
await settle(1000);

const sheet = await page.evaluate(() => {
  const text = document.body.innerText;
  const select = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => /anthropic|openai/i.test(o.value)));
  return {
    byo: /own AI|any AI service/i.test(text),
    services: select ? [...select.options].map((o) => o.value) : [],
    mentionsClaudeApi: /Claude API key/i.test(text),
  };
});
check(sheet.byo, "the AI mode is described as bring-your-own, not one brand");
check(sheet.services.length >= 5, "several AI services to choose from", sheet.services.join(", "));
check(!sheet.mentionsClaudeApi, "no 'Claude API key' wording left in settings");

// ------------------------------------------ back from Settings keeps place
await page.goto(`${BASE}/more/`, { waitUntil: "networkidle2" });
await settle(1200);
await page.evaluate(() => window.scrollTo(0, 400));
await settle(500);
const before = await page.evaluate(() => Math.round(window.scrollY));
await page.evaluate(() => {
  const el = [...document.querySelectorAll("a")].find((a) => (a.getAttribute("href") || "").endsWith("/settings/") && /Settings/.test(a.textContent || ""));
  el?.click();
});
await settle(1600);
const onSettings = await page.evaluate(() => location.pathname);
await page.evaluate(() => document.querySelector('[aria-label="Back"]')?.click());
await settle(1600);
const after = await page.evaluate(() => ({ path: location.pathname, y: Math.round(window.scrollY) }));
check(onSettings.includes("/settings"), "Settings opens from More", onSettings);
check(after.path.includes("/more"), "back returns to More", after.path);
check(Math.abs(after.y - before) < 40, "and lands where you were, not at the top", `was ${before}, now ${after.y}`);

// ------------------------------------------------------- icon picker grid
await page.goto(`${BASE}/bills/`, { waitUntil: "networkidle2" });
await settle(1300);
await clickText("Bill");
await settle(1200);
const icons = await page.evaluate(() => {
  const legend = [...document.querySelectorAll("legend")].find((l) => l.textContent.trim() === "Icon");
  const grid = legend?.parentElement?.querySelector("div");
  if (!grid) return null;
  const style = getComputedStyle(grid);
  const all = [...document.querySelectorAll("button")].find((b) => /All \d+ icons/.test(b.textContent || ""));
  const count = Number(/All (\d+) icons/.exec(all?.textContent ?? "")?.[1] ?? 0);
  return {
    display: style.display,
    overflowX: style.overflowX,
    shown: grid.querySelectorAll("button").length,
    total: count,
    scrolls: grid.scrollWidth > grid.clientWidth + 1,
  };
});
check(icons?.display === "grid", "the icon picker is a grid", icons?.display ?? "missing");
check(icons ? !icons.scrolls : false, "nothing is hidden behind a sideways scroll", icons?.scrolls ? "still scrolls" : "fits");
check((icons?.total ?? 0) >= 48, "plenty of icons to choose from", `${icons?.total ?? 0} total, ${icons?.shown ?? 0} shown first`);

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
