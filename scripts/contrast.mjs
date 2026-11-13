/**
 * Measures real rendered contrast on interactive controls and text, in a given
 * theme, at a given route. Reads computed colours from the live page and walks
 * up for the effective background, so it catches a token that only goes wrong
 * once it lands in a particular context.
 *
 *   node scripts/contrast.mjs [--url=...] [--theme=light|dark] [--seed]
 */
import puppeteer from "puppeteer";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const has = (n) => process.argv.includes(`--${n}`);
const BASE = arg("url", "http://localhost:4173");
const THEME = arg("theme", "light");

const ROUTES = ["/", "/transactions/", "/budgets/", "/goals/", "/accounts/", "/settings/", "/insights/"];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

await page.goto(BASE, { waitUntil: "networkidle2" });
await page.evaluate((t) => localStorage.setItem("owwy-theme", t), THEME);
await page.reload({ waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1500));

if (has("seed") && page.url().includes("/welcome")) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 4000));
}

const measure = () => {
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  // Returns the effective backdrop, or null when it can't be judged — a
  // gradient or image behind the text has no single colour to compare against,
  // and guessing produces confident nonsense.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none") return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0.75) return c;
      n = n.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  };

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("button, a[href], summary, p, h1, h2, h3, span, label")) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.35) continue;
    const text = (el.textContent || "").trim();
    if (!text || text.length > 40) continue;
    if (el.querySelector("button, a, p, h1, h2, h3")) continue; // only leaf-ish text
    const fg = parse(s.color);
    if (!fg || fg.a < 0.5) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    const cr = ratio(fg, bg);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (cr >= need) continue;
    const key = `${text}|${s.color}|${Math.round(cr * 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: text.slice(0, 34), tag: el.tagName.toLowerCase(), cr: Math.round(cr * 100) / 100, need, fg: s.color, bg: `rgb(${bg.r} ${bg.g} ${bg.b})`, size: Math.round(size) });
  }
  return out;
};

let total = 0;
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 900));
  const fails = await page.evaluate(measure);
  total += fails.length;
  console.log(`${route.padEnd(16)} ${fails.length ? `${fails.length} below AA` : "ok"}`);
  for (const f of fails.slice(0, 6)) {
    console.log(`    ${f.cr.toFixed(2)}:1 (needs ${f.need})  <${f.tag}> ${f.size}px  "${f.text}"  ${f.fg} on ${f.bg}`);
  }
}
console.log(`\n${THEME} theme — ${total} contrast failures`);
await browser.close();
