/**
 * Checks the things this round changed, by driving the built app:
 *
 *   - no focusable field computes under 16px (iOS zooms the page otherwise
 *     and never zooms back, which is the "app got bigger" bug)
 *   - the add sheet opens on the keypad, with coloured category tiles
 *   - an automation can repeat on several chosen days of the month
 *   - a budget can be told what it is for
 *   - transaction days sit on a timeline rail
 *
 *   node scripts/verify-changes.mjs [--url=http://localhost:4173]
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

const clickText = (text, selector = "button, a, [role=radio], option") =>
  page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((x) => (x.textContent || "").trim() === t);
      if (!el) return false;
      el.click();
      return true;
    },
    text,
    selector,
  );

/** Every field on screen that iOS would zoom into. */
const smallFields = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        // A sr-only file input is never focused by tapping, so it cannot zoom.
        return r.width > 2 && r.height > 2;
      })
      .map((el) => ({
        px: Number.parseFloat(getComputedStyle(el).fontSize),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") ?? "",
        name: (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.id || "").slice(0, 36),
      }))
      .filter((f) => f.px < 16),
  );

// ---------------------------------------------------------------- seed
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

// ---------------------------------------------------- 16px floor, per route
const ROUTES = ["/", "/transactions/", "/accounts/", "/settings/", "/ask/", "/shopping/", "/notes/", "/owed/", "/afford/", "/insights/"];
const offenders = [];
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
  await settle(700);
  for (const f of await smallFields()) offenders.push({ route, ...f });
}

// ------------------------------------------------- add sheet: keypad first
await page.goto(BASE, { waitUntil: "networkidle2" });
await settle(1200);
await page.evaluate(() => document.querySelector('[aria-label="Add transaction"]')?.click());
await settle(1200);

const sheet = await page.evaluate(() => {
  const keypad = document.querySelector('[role="group"][aria-label="Calculator"]');
  const amount = document.querySelector('input[aria-label="Amount"]');
  const tiles = [...document.querySelectorAll('button[aria-pressed]')].filter((b) => {
    const tile = b.querySelector("span[aria-hidden]");
    return tile && getComputedStyle(tile).backgroundColor !== "rgba(0, 0, 0, 0)";
  });
  return {
    keypadOpen: Boolean(keypad),
    keys: keypad ? keypad.querySelectorAll("button").length : 0,
    amountInputMode: amount?.getAttribute("inputmode") ?? null,
    amountPx: amount ? Number.parseFloat(getComputedStyle(amount).fontSize) : 0,
    colouredTiles: tiles.length,
  };
});
check(sheet.keypadOpen && sheet.keys === 16, "add sheet opens on the calculator keypad", `${sheet.keys} keys`);
check(sheet.amountInputMode === "none", "device keyboard suppressed while the keypad is up", `inputmode=${sheet.amountInputMode}`);
check(sheet.colouredTiles >= 8, "category tiles carry their own colour", `${sheet.colouredTiles} tiles`);

// Tapping the keypad writes straight into the amount — no "Use" step.
await page.evaluate(() => {
  const keypad = document.querySelector('[role="group"][aria-label="Calculator"]');
  for (const label of ["2", "5", "0"]) [...keypad.querySelectorAll("button")].find((b) => b.textContent.trim() === label)?.click();
});
await settle(500);
const typed = await page.evaluate(() => document.querySelector('input[aria-label="Amount"]')?.value);
check(typed === "250", "keypad writes through to the amount as you tap", `amount = "${typed}"`);
for (const f of await smallFields()) offenders.push({ route: "/ (add sheet)", ...f });
await page.keyboard.press("Escape");
await settle(600);

// ------------------------------------------- automation: several month days
await page.goto(`${BASE}/recurring/`, { waitUntil: "networkidle2" });
await settle(1200);
await clickText("New");
await settle(1000);
await page.evaluate(() => {
  const select = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "monthDays"));
  if (!select) return;
  select.value = "monthDays";
  select.dispatchEvent(new Event("change", { bubbles: true }));
});
await settle(800);

const sched = await page.evaluate(() => {
  const grid = document.querySelector('[role="group"][aria-label="Days of the month"]');
  const on = grid ? [...grid.querySelectorAll('[role="checkbox"][aria-checked="true"]')].map((b) => b.textContent.trim()) : [];
  const text = document.body.innerText;
  return { days: grid ? grid.querySelectorAll('[role="checkbox"]').length : 0, on, summary: /Repeats on ([^.]+)\./.exec(text)?.[1] ?? null, first: /Starts ([^.]+)\./.exec(text)?.[1] ?? null };
});
check(sched.days === 31, "a real month of days to choose from", `${sched.days} days`);
check(sched.on.length === 2 && sched.on.join(",") === "15,30", "multiple days selected at once", `on: ${sched.on.join(" & ")}`);
check(Boolean(sched.summary), "the schedule reads back in words", sched.summary ?? "");
check(Boolean(sched.first), "shows the date it will actually first fire", sched.first ?? "");

// Add a third day and confirm it is additive, not a radio group.
await page.evaluate(() => {
  const grid = document.querySelector('[role="group"][aria-label="Days of the month"]');
  [...grid.querySelectorAll('[role="checkbox"]')].find((b) => b.textContent.trim() === "1")?.click();
});
await settle(400);
const three = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-label="Days of the month"] [role="checkbox"][aria-checked="true"]')].map((b) => b.textContent.trim()),
);
check(three.length === 3, "days add up rather than replacing each other", three.join(", "));
for (const f of await smallFields()) offenders.push({ route: "/recurring/ (sheet)", ...f });
await page.keyboard.press("Escape");
await settle(600);

// ------------------------------------------------ budget: say what it's for
await page.goto(`${BASE}/budgets/`, { waitUntil: "networkidle2" });
await settle(1200);
await clickText("Budget");
await settle(1000);
const budget = await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")].map((l) => l.textContent.trim());
  const field = labels.find((l) => /what'?s it for/i.test(l));
  const input = [...document.querySelectorAll("input")].find((i) => (i.placeholder || "").startsWith("e.g."));
  return { field: field ?? null, placeholder: input?.placeholder ?? null };
});
check(Boolean(budget.field), "a budget can be told what it is for", budget.field ?? "");
for (const f of await smallFields()) offenders.push({ route: "/budgets/ (sheet)", ...f });
await page.keyboard.press("Escape");
await settle(600);

// ---------------------------------------------------------- timeline rail
await page.goto(`${BASE}/transactions/`, { waitUntil: "networkidle2" });
await settle(1400);
const rail = await page.evaluate(() => {
  const sections = [...document.querySelectorAll("section")].filter((s) => s.querySelector("h2") && s.className.includes("pl-6"));
  const dots = sections.filter((s) => [...s.children].some((c) => c.tagName === "SPAN" && c.className.includes("rounded-full")));
  return { sections: sections.length, dots: dots.length };
});
check(rail.sections > 0 && rail.dots === rail.sections, "transaction days sit on a timeline rail", `${rail.dots}/${rail.sections} days have a marker`);

// ------------------------------------------------------- two-up stat tiles
await page.goto(`${BASE}/insights/`, { waitUntil: "networkidle2" });
await settle(1400);
const twoUp = await page.evaluate(() => {
  const text = document.body.innerText;
  return { last14: text.includes("Last 14 days"), biggest: text.includes("Biggest day") };
});
check(twoUp.last14 && twoUp.biggest, "insight tiles pair a number with its shape");

// ------------------------------------------------------------------ report
console.log("");
if (offenders.length) {
  console.log(`FAIL  ${offenders.length} field(s) under 16px — iOS would zoom on these:`);
  for (const o of offenders) console.log(`        ${o.route} ${o.tag}${o.type ? `[${o.type}]` : ""} "${o.name}" ${o.px}px`);
  failures++;
} else {
  console.log("PASS  every visible field is at least 16px — no iOS focus zoom");
}

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
