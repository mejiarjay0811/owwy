/**
 * Measures real rendered contrast on interactive controls and text, in a given
 * theme, at a given route. Reads computed colours from the live page and walks
 * up for the effective background, so it catches a token that only goes wrong
 * once it lands in a particular context.
 *
 *   node scripts/contrast.mjs [--url=...] [--theme=light|dark] [--seed]
 *                             [--palette=berry] [--hero=parchment]
 *
 * The theme, palette and finish are written where the app actually reads
 * them: the stored settings. localStorage alone is not enough — it is only
 * the cache the pre-paint script reads, and the app writes the stored value
 * straight back over it a moment later, which is how every "dark theme" run
 * before this quietly measured the light one. The run prints what it ended up
 * measuring and fails if that isn't what was asked for.
 */
import puppeteer from "puppeteer";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const has = (n) => process.argv.includes(`--${n}`);
const BASE = arg("url", "http://localhost:4173");
const THEME = arg("theme", "light");
const PALETTE = arg("palette", "");
const HERO = arg("hero", "");

const ROUTES = ["/", "/transactions/", "/budgets/", "/goals/", "/accounts/", "/settings/", "/insights/"];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });

await page.goto(BASE, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1500));

if (has("seed") && page.url().includes("/welcome")) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 4000));
}

// Patch the stored settings, which is what the app reads on every load.
await page.evaluate(
  async (t, p, h) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("owwy");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const store = db.transaction("settings", "readwrite").objectStore("settings");
    const current = await new Promise((res) => {
      const q = store.get("app");
      q.onsuccess = () => res(q.result);
    });
    if (!current) return;
    store.put({ ...current, theme: t, ...(p ? { palette: p } : {}), ...(h ? { heroStyle: h } : {}) });
  },
  THEME,
  PALETTE,
  HERO,
);
await page.reload({ waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2000));

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
/**
 * The theme and palette are stored in IndexedDB, and ThemeSync writes them
 * back over localStorage once the app has loaded — so the run is only
 * measuring what it was asked to measure if the page still agrees.
 */
const applied = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  palette: document.documentElement.dataset.palette,
  hero: document.documentElement.dataset.hero,
  brand: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
}));
const asked = { theme: THEME, palette: PALETTE || applied.palette, hero: HERO || applied.hero };
const honest = applied.theme === asked.theme && applied.palette === asked.palette && applied.hero === asked.hero;
console.log(`\nmeasured: ${applied.theme} · ${applied.palette} · hero ${applied.hero} · brand ${applied.brand}`);
if (!honest) {
  console.log(`MISMATCH — asked for ${asked.theme} · ${asked.palette} · hero ${asked.hero}; these numbers are for something else`);
  total += 1;
}
console.log(`${applied.theme} theme, ${applied.palette} palette — ${total} contrast failures`);
await browser.close();
