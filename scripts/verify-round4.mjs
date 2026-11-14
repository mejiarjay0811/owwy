/**
 * The round that added colour palettes, a customisable balance card, a
 * stacked wallet, multi-answer setup, and stopped the keyboard rearranging
 * the app. Each check reads what the browser actually computed.
 *
 *   node scripts/verify-round4.mjs [--url=http://localhost:4173]
 */
import puppeteer from "puppeteer";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:4173";
const browser = await puppeteer.launch({ headless: true });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
};

/**
 * A phone-sized install seeded with the sample data, past the tour.
 *
 * `hideVisualViewport` removes `window.visualViewport` before the app loads,
 * which is what an older WebView looks like — and the only one of the two
 * code paths a headless browser can actually drive, since there is no
 * on-screen keyboard here to shrink the visual viewport.
 */
async function phone(width = 393, height = 852, hideVisualViewport = false) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  if (hideVisualViewport) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    });
  }
  await page.setViewport({ width, height, hasTouch: true, isMobile: true });
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

const go = async (page, settle, route, ms = 1600) => {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
  await settle(ms);
};

/**
 * Click the first thing whose label contains `text`.
 *
 * `root` matters more than it looks: the transactions page has its own
 * Expense/Income filter, so an unscoped search for "Income" clicks the page
 * behind the sheet and every check after it is measuring the wrong form.
 */
const tapText = (page, text, selector = "button", root = "body") =>
  page.evaluate(
    (t, sel, rootSel) => {
      const scope = document.querySelector(rootSel);
      const el = [...(scope?.querySelectorAll(sel) ?? [])].find((x) => (x.textContent || "").trim().includes(t));
      el?.click();
      return Boolean(el);
    },
    text,
    selector,
    root,
  );

const SHEET = '[role="dialog"][data-state="open"]';

/* ------------------------------------------------------------- palettes */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/settings/");

  const evergreen = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  check(evergreen === "#14463f", "a new install starts on Owwy's own green", evergreen);

  // Scoped to the Colour fieldset: the theme switcher is radios too, and
  // counting those would let three palettes pass a check for seven.
  const names = await page.evaluate(() => {
    const legend = [...document.querySelectorAll("legend")].find((l) => l.textContent.trim() === "Colour");
    return [...(legend?.parentElement?.querySelectorAll('[role="radio"]') ?? [])].map((b) => (b.textContent || "").trim());
  });
  check(names.length >= 7, "the picker offers every palette", `${names.length}: ${names.join(", ")}`);

  const picked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="radio"]')].find((x) => (x.textContent || "").trim() === "Berry");
    b?.click();
    return Boolean(b);
  });
  await settle(900);
  const berry = await page.evaluate(() => ({
    brand: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
    attr: document.documentElement.dataset.palette,
    stored: localStorage.getItem("owwy-palette"),
  }));
  check(picked && berry.brand === "#7a2f4c", "choosing Berry repaints the brand colour", `${berry.brand} (${berry.attr})`);

  // Where it has to show up: a primary button.
  const button = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((b) => getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)" && b.className.includes("bg-brand"));
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  check(button === "rgb(122, 47, 76)", "and the buttons with it", String(button));

  await page.reload({ waitUntil: "networkidle2" });
  await settle(1800);
  const afterReload = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  check(afterReload === "#7a2f4c", "the choice survives a reload, from the first paint", afterReload);

  // The page surfaces are deliberately left alone, so text stays readable.
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
  check(bg === "#f6f3ec", "the paper behind the text is not repainted", bg);

  // Dark mode gets its own values, not an inversion of the light ones.
  // Set through the app: the stored preference is the source of truth and
  // ThemeSync writes it straight back over anything put in localStorage.
  await tapText(page, "Dark", '[role="radio"]');
  await settle(900);
  await page.reload({ waitUntil: "networkidle2" });
  await settle(1800);
  const berryDark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  check(berryDark === "#f0a0bd", "dark mode has its own version of the palette", berryDark);

  await context.close();
}

/* -------------------------------------------------------- balance card */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/settings/");

  const heroStart = await page.evaluate(() => ({
    bg: getComputedStyle(document.documentElement).getPropertyValue("--hero-bg").trim(),
    attr: document.documentElement.dataset.hero,
  }));
  check(heroStart.attr === "theme" && heroStart.bg.includes("gradient"), "the balance card follows the palette by default", heroStart.attr);

  const chose = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="radio"]')].find((x) => x.getAttribute("aria-label") === "Parchment");
    b?.click();
    return Boolean(b);
  });
  await settle(800);
  const parchment = await page.evaluate(() => ({
    hero: document.documentElement.dataset.hero,
    ink: getComputedStyle(document.documentElement).getPropertyValue("--hero-ink").trim(),
  }));
  check(chose && parchment.hero === "parchment", "a finish can be chosen", parchment.hero);
  check(parchment.ink === "#2b2418", "and a pale finish flips to dark ink, so it stays readable", parchment.ink);

  const patterned = await tapText(page, "Waves");
  await settle(600);

  // The real card on Home, not the preview.
  await go(page, settle, "/", 2000);
  const home = await page.evaluate(() => {
    const card = document.querySelector('[data-tour="safe"]');
    if (!card) return null;
    const svg = card.querySelector("svg[aria-hidden]");
    return {
      bg: getComputedStyle(card).backgroundImage.slice(0, 40),
      color: getComputedStyle(card).color,
      paths: svg ? svg.querySelectorAll("path").length : 0,
    };
  });
  check(Boolean(home) && home.color === "rgb(43, 36, 24)", "Home's balance card wears the chosen finish", home ? home.color : "no card");
  check(patterned && home && home.paths > 4, "and the chosen pattern", home ? `${home.paths} strokes` : "none");

  // Wallet's total is the same object seen twice, so it matches.
  await go(page, settle, "/accounts/", 2000);
  const wallet = await page.evaluate(() => {
    const el = document.querySelector('section[aria-label="Wallet summary"]');
    return el ? getComputedStyle(el).color : null;
  });
  check(wallet === "rgb(43, 36, 24)", "Wallet's total matches it", String(wallet));

  await context.close();
}

/* ---------------------------------------------------------- the wallet */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/accounts/", 2200);

  const stack = await page.evaluate(() => {
    const list = document.querySelector('[role="list"][aria-label$="stacked"]');
    if (!list) return null;
    const cards = [...list.querySelectorAll('[role="listitem"]')];
    const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top));
    const box = list.getBoundingClientRect();
    const hidden = cards.filter((c) => Number(getComputedStyle(c).opacity) < 0.5).length;
    return { count: cards.length, tops, hidden, overflows: box.right > window.innerWidth + 1 };
  });
  check(Boolean(stack) && stack.count > 1, "the wallet opens as a deck", stack ? `${stack.count} cards` : "no deck");
  check(stack && stack.hidden === 0, "with every account in it, not just the first few", stack ? `${stack.hidden} hidden of ${stack.count}` : "");
  check(stack && new Set(stack.tops).size === stack.tops.length, "and each one showing its own top edge", stack ? stack.tops.join(", ") : "");
  check(stack && !stack.overflows, "and it fits the screen");

  // Tapping a card behind deals it forward rather than opening it.
  const dealt = await page.evaluate(() => {
    const list = document.querySelector('[role="list"][aria-label$="stacked"]');
    const second = [...list.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").includes("bring to front"));
    const name = second?.getAttribute("aria-label")?.split(",")[0];
    second?.click();
    return name;
  });
  await settle(700);
  const front = await page.evaluate(() => {
    const list = document.querySelector('[role="list"][aria-label$="stacked"]');
    return list?.querySelector("button")?.getAttribute("aria-label");
  });
  check(Boolean(dealt) && front?.startsWith(dealt) && front.includes("open details"), "tapping a card behind brings it to the front", `${dealt} -> ${front}`);

  const switched = await tapText(page, "List", '[role="radio"]', "main");
  await settle(700);
  const asList = await page.evaluate(() => !document.querySelector('[role="list"][aria-label$="stacked"]'));
  check(switched && asList, "Grid and List are still there for anyone who prefers them");

  await context.close();
}

/* -------------------------------------- adding money: categories & cards */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/transactions/");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Add transaction")?.click());
  await settle(1400);
  const switchedType = await tapText(page, "Income", '[role="radio"]', SHEET);
  await settle(900);
  const onIncome = await page.evaluate(
    (sel) => document.querySelector(`${sel} [role="radio"][aria-checked="true"]`)?.textContent?.trim(),
    SHEET,
  );
  check(switchedType && onIncome === "Income", "the sheet can be switched to income", String(onIncome));

  const income = await page.evaluate(() => {
    const legend = [...document.querySelectorAll("legend")].find((l) => l.textContent.trim() === "Category");
    const grid = legend?.nextElementSibling;
    const more = [...document.querySelectorAll("button")].find((b) => /All \d+ categories/.test(b.textContent || ""));
    return { shown: grid ? grid.children.length : 0, more: more?.textContent.trim() ?? null };
  });
  check(income.shown === 8, "income shows the eight you reach for most", `${income.shown} tiles`);
  check(/All 1[0-9] categories/.test(income.more ?? ""), "with the rest one tap away", String(income.more));

  const expanded = await tapText(page, "All 1", "button", SHEET);
  await settle(700);
  const afterAll = await page.evaluate(() => {
    const legend = [...document.querySelectorAll("legend")].find((l) => l.textContent.trim() === "Category");
    return legend?.nextElementSibling?.children.length ?? 0;
  });
  check(expanded && afterAll > income.shown, "View all shows them all", `${afterAll} tiles`);

  // "Received in" is a grid now, so no card hides off the right edge.
  const received = await page.evaluate(() => {
    const legend = [...document.querySelectorAll("legend")].find((l) => (l.textContent || "").includes("Received in"));
    const grid = legend?.parentElement?.querySelector("div.grid, div[class*=grid-cols]");
    if (!grid) return null;
    const cards = [...grid.children];
    const rows = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top)));
    return {
      count: cards.length,
      rows: rows.size,
      scrollable: grid.scrollWidth > grid.clientWidth + 1,
      offscreen: cards.filter((c) => c.getBoundingClientRect().right > window.innerWidth + 1).length,
    };
  });
  check(Boolean(received) && !received.scrollable, "Received in no longer scrolls sideways", received ? `scrollWidth ${received.scrollable}` : "not found");
  check(received && received.offscreen === 0, "so every account is on screen", received ? `${received.count} cards over ${received.rows} rows` : "");

  // Choosing "Other income" asks what it actually was.
  const other = await page.evaluate(() => {
    const tile = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "✨Other income" || (b.textContent || "").trim() === "Other income");
    tile?.click();
    return Boolean(tile);
  });
  await settle(700);
  const asked = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) => /What kind of income/.test(l.textContent || ""));
    const notes = [...document.querySelectorAll("label")].filter((l) => (l.textContent || "").trim() === "Note");
    return { label: label?.textContent.trim() ?? null, duplicateNote: notes.length };
  });
  check(other && Boolean(asked.label), "choosing Other income asks what it was", String(asked.label));
  check(asked.duplicateNote === 0, "and doesn't leave a second Note field asking the same thing");

  // The same on the way out, which is where most people meet "Other".
  await tapText(page, "Expense", '[role="radio"]', SHEET);
  await settle(900);
  const expenseOther = await page.evaluate(() => {
    const tile = [...document.querySelectorAll("button")].find((b) => /^(📦)?Other$/.test((b.textContent || "").trim()));
    tile?.click();
    return Boolean(tile);
  });
  await settle(700);
  const expenseAsked = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) => /What was it\?/.test(l.textContent || ""));
    const input = label?.parentElement?.parentElement?.querySelector("input");
    if (!input) return null;
    input.focus();
    return { label: label.textContent.trim(), size: parseFloat(getComputedStyle(input).fontSize) };
  });
  check(expenseOther && Boolean(expenseAsked), "and an Other expense is asked the same question", expenseAsked ? expenseAsked.label : "not asked");
  check(expenseAsked && expenseAsked.size >= 16, "in a field iOS won't zoom into", expenseAsked ? `${expenseAsked.size}px` : "");

  await context.close();
}

/* ---------------------------------------------------------- Ask Owwy */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/ask/", 2000);
  const ask = await page.evaluate(() => {
    const groups = [...document.querySelectorAll("p")].filter((p) => /^(Where it went|What's left|What's coming|Log something)$/.test((p.textContent || "").trim()));
    const chips = [...document.querySelectorAll("button")].filter((b) => /\?$|^\w+ \d+/.test((b.textContent || "").trim()));
    return { groups: groups.map((g) => g.textContent.trim()), chips: chips.length };
  });
  check(ask.groups.length >= 4, "the starter questions are grouped by what you're after", ask.groups.join(" · "));
  check(ask.chips >= 10, "and there are plenty of them", `${ask.chips} chips`);

  const asked = await page.evaluate(() => {
    const chip = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "What is my net worth?");
    chip?.click();
    return Boolean(chip);
  });
  await settle(3000);
  const answered = await page.evaluate(() => document.body.innerText.includes("net worth") && !document.body.innerText.includes("Something went wrong"));
  check(asked && answered, "and a new one is answered on the device");

  await context.close();
}

/* ------------------------------------------------- setup: more than one */
{
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 393, height: 852, hasTouch: true, isMobile: true });
  const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
  await page.goto(`${BASE}/welcome/`, { waitUntil: "networkidle2" });
  await settle(2000);

  for (const label of ["Let's go", "Continue", "Continue"]) {
    await page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim().startsWith(t))?.click(), label);
    await settle(900);
  }

  const step = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim());
  check(step === "What matters most right now?", "setup still asks what matters most", String(step));

  const multi = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[role="checkbox"]')];
    return { count: boxes.length, radios: document.querySelectorAll('[role="radio"]').length };
  });
  check(multi.count === 5 && multi.radios === 0, "as checkboxes, not one-of-five", `${multi.count} checkboxes, ${multi.radios} radios`);

  // One click per step, with a frame in between: clicking and reading in the
  // same evaluate reads the state React hasn't rendered yet.
  for (const label of ["Save money", "Control spending"]) {
    await tapText(page, label, '[role="checkbox"]');
    await settle(350);
  }
  const chosen = await page.evaluate(() =>
    [...document.querySelectorAll('[role="checkbox"][aria-checked="true"]')].map((b) => b.textContent.replace(/(Build|Stop|See|Get|Owwy).*/, "").trim()),
  );
  check(chosen.length === 3, "and several can be chosen at once", chosen.join(" · "));

  for (const label of chosen) {
    await tapText(page, label, '[role="checkbox"]');
    await settle(350);
  }
  const last = await page.evaluate(() => document.querySelectorAll('[role="checkbox"][aria-checked="true"]').length);
  check(last === 1, "but never none, because that isn't an answer to the question", `${last} left`);

  await context.close();
}

/* ------------------------------------------------- the keyboard's turn */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/", 2200);

  // Make sure the Grove is on: the report was about typing inside it.
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
    store.put({ ...current, dashboard: current.dashboard.map((w) => (w.id === "grove" ? { ...w, visible: true } : w)) });
  });
  await page.reload({ waitUntil: "networkidle2" });
  await settle(2400);

  const meta = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "");
  check(meta.includes("interactive-widget=resizes-visual"), "the keyboard floats over the page instead of shrinking it", meta);
  check(!meta.includes("maximum-scale") && !meta.includes("user-scalable=no"), "and pinch zoom is still allowed (WCAG 1.4.4)");

  // Every field on the first screen is at least 16px, or iOS zooms in.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), what: el.getAttribute("placeholder") || el.type }))
      .filter((f) => f.size < 16),
  );
  check(small.length === 0, "no field is small enough to make iOS zoom in", small.map((f) => `${f.what} ${f.size}px`).join(", "));

  const composer = await page.evaluate(() => {
    const input = document.querySelector('[data-tour="composer"] input');
    if (!input) return null;
    const before = input.getBoundingClientRect();
    return { placeholder: input.placeholder, width: Math.round(before.width) };
  });
  check(Boolean(composer), "the composer is on Home", composer ? `"${composer.placeholder}"` : "missing");

  /**
   * Headless Chrome has no on-screen keyboard, so the attribute is driven
   * directly: what's being checked is that the app's response to it is right
   * — the tab bar gets out of the way and the sheet makes room — not that
   * the detection fires, which `--kb` can only learn from a real keyboard.
   */
  const before = await page.evaluate(() => {
    const nav = document.querySelector('nav[data-nav="bottom"]');
    return { opacity: getComputedStyle(nav).opacity, visibility: getComputedStyle(nav).visibility };
  });
  check(before.opacity === "1" && before.visibility === "visible", "the tab bar is there while you're reading");

  await page.evaluate(() => {
    document.documentElement.dataset.keyboard = "open";
  });
  await settle(400);
  const during = await page.evaluate(() => {
    const nav = document.querySelector('nav[data-nav="bottom"]');
    return { opacity: getComputedStyle(nav).opacity, visibility: getComputedStyle(nav).visibility };
  });
  check(during.opacity === "0" && during.visibility === "hidden", "and steps aside while you're typing", `opacity ${during.opacity}, ${during.visibility}`);

  // Nothing about the page's own size reacts to it.
  const sizes = await page.evaluate(() => {
    const read = () => {
      const grove = document.querySelector('[data-tour="grove"]');
      return { grove: grove ? Math.round(grove.getBoundingClientRect().height) : 0, width: document.documentElement.scrollWidth };
    };
    document.documentElement.dataset.keyboard = "closed";
    const closed = read();
    document.documentElement.dataset.keyboard = "open";
    const open = read();
    document.documentElement.dataset.keyboard = "closed";
    return { closed, open };
  });
  check(sizes.closed.grove === sizes.open.grove, "the Grove is exactly the same size either way", `${sizes.closed.grove}px vs ${sizes.open.grove}px`);
  check(sizes.closed.width === sizes.open.width, "and so is the page");

  // The sheet is the one thing that does make room, on purpose.
  await page.evaluate(() => {
    document.documentElement.dataset.keyboard = "closed";
    [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Add transaction")?.click();
  });
  await settle(1400);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--kb", "300px");
    document.documentElement.dataset.keyboard = "open";
  });
  await settle(500);
  const sheet = await page.evaluate((sel) => {
    const panel = document.querySelector(sel);
    if (!panel) return null;
    const box = panel.getBoundingClientRect();
    const footer = [...panel.querySelectorAll("button")].find((b) => /^Add /.test((b.textContent || "").trim()));
    return {
      bottom: Math.round(window.innerHeight - box.bottom),
      saveVisible: footer ? Math.round(footer.getBoundingClientRect().bottom) <= window.innerHeight - 290 : false,
    };
  }, SHEET);
  check(sheet && sheet.bottom >= 280, "a sheet lifts clear of the keyboard", sheet ? `${sheet.bottom}px above the bottom` : "no sheet");
  check(sheet && sheet.saveVisible, "so its Save button is still on screen", sheet ? String(sheet.saveVisible) : "");

  await context.close();
}

/* ------------------------------------- and the page goes back afterwards */
{
  const { page, context, settle } = await phone(393, 852, true);
  await go(page, settle, "/transactions/", 2200);

  /**
   * What the bug looked like: the browser scrolls the focused field into
   * view, and when the keyboard closes the page is left wherever that put it.
   * A plain `scrollTo` is exactly what the browser's own panning looks like
   * from the page's side — an ordinary scroll event and nothing else — so
   * this drives the real path rather than a stand-in for it.
   */
  const restored = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.scrollTo({ top: 400, behavior: "auto" });
    await wait(200);
    const before = Math.round(window.scrollY);

    const input = document.querySelector("input:not([type=checkbox]):not([type=radio])");
    input.focus();
    await wait(200);
    window.scrollTo({ top: 900, behavior: "auto" });
    await wait(200);
    const panned = Math.round(window.scrollY);

    input.blur();
    await wait(700);
    return { before, panned, after: Math.round(window.scrollY) };
  });
  check(restored.panned !== restored.before, "the page does get moved while a field is focused", `${restored.before} -> ${restored.panned}`);
  check(restored.after === restored.before, "and is put back where it was when the keyboard closes", `back to ${restored.after}`);

  // But not if the reader scrolled on purpose: then where they are is where
  // they want to be, and restoring would be the app fighting them.
  const kept = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.scrollTo({ top: 300, behavior: "auto" });
    await wait(200);
    const input = document.querySelector("input:not([type=checkbox]):not([type=radio])");
    input.focus();
    await wait(200);

    const touch = (type, y) =>
      document.body.dispatchEvent(
        new TouchEvent(type, { bubbles: true, touches: type === "touchend" ? [] : [new Touch({ identifier: 1, target: document.body, clientY: y })] }),
      );
    touch("touchstart", 500);
    touch("touchmove", 380);
    touch("touchend", 380);
    window.scrollTo({ top: 1200, behavior: "auto" });
    await wait(200);
    const chosen = Math.round(window.scrollY);

    input.blur();
    await wait(700);
    return { chosen, after: Math.round(window.scrollY) };
  });
  check(kept.after === kept.chosen, "unless the reader scrolled themselves, which is left alone", `stayed at ${kept.after}`);

  await context.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
