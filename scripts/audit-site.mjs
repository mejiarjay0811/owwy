// Temporary: responsive + a11y check for the marketing site.
import puppeteer from "puppeteer";

const VIEWPORTS = [
  [320, 568], [360, 740], [375, 667], [393, 852], [430, 932],
  [768, 1024], [834, 1112], [1024, 768], [1280, 800], [1366, 768], [1440, 900], [1920, 1080],
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
page.on("pageerror", (e) => errors.push("UNCAUGHT: " + String(e).slice(0, 160)));

await page.goto("http://localhost:4180/", { waitUntil: "networkidle2" });

for (const [w, h] of VIEWPORTS) {
  await page.setViewport({ width: w, height: h });
  await new Promise((r) => setTimeout(r, 400));
  const res = await page.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    const offenders = [];
    if (over > 1) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > doc.clientWidth + 1) offenders.push(el.tagName.toLowerCase() + "." + String(el.className).slice(0, 50));
      }
    }
    const small = [...document.querySelectorAll("a[href],button,summary")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && Math.min(r.width, r.height) < 44; })
      .map((el) => `${el.tagName.toLowerCase()} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} "${(el.textContent || "").trim().slice(0, 22)}"`);
    return { over, offenders: [...new Set(offenders)].slice(0, 3), small: [...new Set(small)] };
  });
  console.log(`${String(w).padStart(4)}px  overflow=${res.over}${res.offenders.length ? "  " + res.offenders.join(", ") : ""}${res.small.length ? "  SMALL: " + res.small.join(" | ") : ""}`);
}

// Accessible names from Chrome's own tree.
await page.setViewport({ width: 1440, height: 900 });
const tree = await page.accessibility.snapshot({ interestingOnly: false });
const unnamed = [];
(function walk(n) {
  if (!n) return;
  if (["button", "link", "heading"].includes(n.role) && !(n.name ?? "").trim()) unnamed.push(n.role);
  (n.children ?? []).forEach(walk);
})(tree);
const headings = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3")].map((h) => Number(h.tagName[1])));
const skips = headings.filter((l, i) => i && l - headings[i - 1] > 1).length;
console.log(`\nunnamed controls: ${unnamed.length}  ·  h1 count: ${headings.filter((l) => l === 1).length}  ·  heading skips: ${skips}`);
console.log(errors.length ? "CONSOLE ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
