/**
 * The app is client-rendered behind a splash, so fetching HTML proves
 * nothing about what shipped. Drive the real deployment instead.
 */
import puppeteer from "puppeteer";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "https://owwy-app.vercel.app";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852 });
const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
await settle(2000);
if (page.url().includes("/welcome")) {
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"))?.click());
  await settle(4000);
}

const tour = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (!d) return null;
  const hole = [...d.querySelectorAll("div")].find((x) => (x.style.boxShadow || "").includes("9999px"));
  const r = hole?.getBoundingClientRect();
  return { title: d.querySelector("h2")?.textContent, spotlight: r && r.width > 2 ? `${Math.round(r.width)}x${Math.round(r.height)}` : "none" };
});
console.log("coach marks on first run:", tour ? `"${tour.title}" spotlight ${tour.spotlight}` : "NOT SHOWN");

for (let i = 0; i < 8 && (await page.$('[role="dialog"][aria-modal="true"]')); i++) {
  await page.keyboard.press("Escape");
  await settle(400);
}

await page.goto(`${BASE}/more/`, { waitUntil: "networkidle2", timeout: 60000 });
await settle(2500);
const more = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("li > a, li > button")];
  const hitSized = cards.filter((c) => c.getBoundingClientRect().height >= 60).length;
  return {
    subtitle: [...document.querySelectorAll("div,p")].some((e) => e.textContent?.trim() === "Everything else Owwy can do."),
    terms: cards.some((c) => (c.textContent || "").includes("Terms")),
    cards: cards.length,
    generous: hitSized,
  };
});
console.log("more page:", JSON.stringify(more));

const hit = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="Back to settings"], [aria-label="Back"]');
  return el ? getComputedStyle(el, "::after").width : "no back link here";
});
await page.goto(`${BASE}/privacy/`, { waitUntil: "networkidle2", timeout: 60000 });
await settle(1200);
console.log(
  "back-link hit area:",
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Back to settings"]');
    return el ? `${getComputedStyle(el, "::after").width} x ${getComputedStyle(el, "::after").height}` : "missing";
  }),
  `(home: ${hit})`,
);

await browser.close();
