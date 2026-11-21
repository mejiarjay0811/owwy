/**
 * The round that made archived accounts deletable, stopped the budget sheet
 * silently replacing a budget, fixed a savings target you couldn't save on a
 * phone, and replaced every emoji with a drawn icon.
 *
 *   node scripts/verify-round5.mjs [--url=http://localhost:4173]
 */
import puppeteer from "puppeteer";

const BASE = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:4173";
const browser = await puppeteer.launch({ headless: true });

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
};

const SHEET = '[role="dialog"][data-state="open"]';

async function phone(width = 393, height = 852) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height, hasTouch: true, isMobile: true });
  await page.emulateTimezone("Asia/Manila");
  const settle = (ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await settle(1600);
  if (page.url().includes("/welcome")) {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("Explore with sample data"))?.click());
    await settle(4500);
  }
  for (let i = 0; i < 8 && (await page.$('[role="dialog"][aria-modal="true"]')); i++) {
    await page.keyboard.press("Escape");
    await settle(400);
  }
  return { page, context, settle };
}

const go = async (page, settle, route, ms = 1900) => {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
  await settle(ms);
};

const tap = (page, text, selector = "button", root = "body") =>
  page.evaluate(
    (t, sel, rootSel) => {
      const scope = document.querySelector(rootSel);
      const el = [...(scope?.querySelectorAll(sel) ?? [])].find((x) => (x.textContent || "").trim() === t);
      el?.click();
      return Boolean(el);
    },
    text,
    selector,
    root,
  );

const counts = (page) =>
  page.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("owwy");
      r.onsuccess = () => res(r.result);
    });
    const get = (s) =>
      new Promise((res) => {
        const q = db.transaction(s, "readonly").objectStore(s).getAll();
        q.onsuccess = () => res(q.result);
      });
    const [a, t, g, rc] = await Promise.all([get("accounts"), get("transactions"), get("goals"), get("recurring")]);
    return { accounts: a.length, transactions: t.length, goals: g.length, recurring: rc.length };
  });

const archive = (page, names) =>
  page.evaluate(async (wanted) => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("owwy");
      r.onsuccess = () => res(r.result);
    });
    const all = await new Promise((res) => {
      const q = db.transaction("accounts", "readonly").objectStore("accounts").getAll();
      q.onsuccess = () => res(q.result);
    });
    const store = db.transaction("accounts", "readwrite").objectStore("accounts");
    for (const a of all) if (wanted === "all" || wanted.includes(a.name)) store.put({ ...a, archived: true });
  }, names);

const openArchived = async (page, settle, label) => {
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Archived \(/.test((b.textContent || "").trim()))?.click());
  await settle(700);
  await page.evaluate((l) => document.querySelector(`button[aria-label="${l}"]`)?.click(), label);
  await settle(1200);
};

/* ============================ 1 & 2: an archived account can be removed */
{
  const { page, context, settle } = await phone();
  await archive(page, ["Main Wallet", "Savings", "Travel USD"]);
  await go(page, settle, "/accounts/", 2300);

  // A bank account that has been used: no Delete button existed at all.
  await openArchived(page, settle, "Main Wallet (archived)");
  const bank = await page.evaluate((sel) => {
    const sheet = document.querySelector(sel);
    const buttons = [...sheet.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
    return { offered: buttons.includes("Delete"), restore: buttons.includes("Restore") };
  }, SHEET);
  check(bank.offered, "an archived bank account with history offers Delete");
  check(bank.restore, "and Restore, which is still the better answer");

  await tap(page, "Delete", "button", SHEET);
  await settle(900);
  const warning = await page.evaluate(() => [...document.querySelectorAll('[role="alertdialog"], [role="dialog"]')].pop()?.textContent ?? "");
  check(/\d+ transactions/.test(warning) && /automation/.test(warning), "the confirmation counts exactly what goes", warning.slice(22, 92));
  check(/Archiving keeps all of it/.test(warning), "and still points at archiving");
  check(/undo/i.test(warning), "and promises the undo it actually has");

  const before = await counts(page);
  await tap(page, "Delete it all");
  await settle(1600);
  const after = await counts(page);
  check(after.accounts === before.accounts - 1 && after.transactions < before.transactions, "deleting takes the history with it", `${before.transactions} -> ${after.transactions} transactions`);

  await tap(page, "Undo");
  await settle(1500);
  const undone = await counts(page);
  check(JSON.stringify(undone) === JSON.stringify(before), "and Undo puts every row back", JSON.stringify(undone));

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape");
    await settle(300);
  }

  // A savings account with goals but barely any transactions: this one used
  // to show a Delete button that always failed with "archive it instead".
  await go(page, settle, "/accounts/", 2000);
  await openArchived(page, settle, "Savings (archived)");
  await tap(page, "Delete", "button", SHEET);
  await settle(900);
  const goalWarning = await page.evaluate(() => [...document.querySelectorAll('[role="alertdialog"], [role="dialog"]')].pop()?.textContent ?? "");
  check(/savings goal/.test(goalWarning), "an account holding goals says so", goalWarning.slice(16, 80));
  check(!/Archive it instead/.test(goalWarning), "and never says 'archive it instead' to something already archived");

  await tap(page, "Delete it all");
  await settle(1500);
  const gone = await page.evaluate(() => [...document.querySelectorAll("[role=status],[role=alert]")].map((e) => e.textContent.trim()).join(" "));
  check(/deleted/i.test(gone) && !/Archive it instead/.test(gone), "and it actually goes", gone.slice(0, 60));

  await context.close();
}

/* ======================= the archive stays reachable with nothing active */
{
  const { page, context, settle } = await phone();
  await archive(page, "all");
  await go(page, settle, "/accounts/", 2300);
  const state = await page.evaluate(() => ({
    toggle: [...document.querySelectorAll("button")].some((b) => /^Archived \(/.test((b.textContent || "").trim())),
    heading: [...document.querySelectorAll("h2, h3, p")].map((e) => e.textContent.trim()).find((t) => /archived/i.test(t)) ?? "",
  }));
  check(state.toggle, "archiving your last account doesn't hide the archive", state.heading.slice(0, 48));
  await context.close();
}

/* ===================================== 3: one budget per category, ever */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/budgets/");
  const existing = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("owwy");
      r.onsuccess = () => res(r.result);
    });
    const all = await new Promise((res) => {
      const q = db.transaction("budgets", "readonly").objectStore("budgets").getAll();
      q.onsuccess = () => res(q.result);
    });
    const keys = all.map((b) => `${b.month}|${b.categoryId}`);
    return { total: all.length, unique: new Set(keys).size };
  });
  check(existing.total === existing.unique, "no category has two budgets in a month", `${existing.total} budgets, ${existing.unique} distinct`);

  await tap(page, "Budget");
  await settle(1300);
  const tiles = await page.evaluate((sel) => {
    const sheet = document.querySelector(sel);
    const legend = [...sheet.querySelectorAll("legend")].find((l) => l.textContent.trim() === "Category");
    const grid = legend?.nextElementSibling;
    const all = [...(grid?.children ?? [])];
    return {
      total: all.length,
      marked: all.filter((b) => b.querySelector('[aria-label="Already budgeted"]')).length,
      firstMarked: all.find((b) => b.querySelector('[aria-label="Already budgeted"]'))?.textContent.replace("Budgeted", "").trim(),
    };
  }, SHEET);
  check(tiles.marked > 0, "the ones that already have a budget are marked", `${tiles.marked} of ${tiles.total} say "Budgeted"`);

  await page.evaluate(
    (sel, n) => {
      const sheet = document.querySelector(sel);
      [...sheet.querySelectorAll("button")].find((b) => (b.textContent || "").replace("Budgeted", "").trim() === n)?.click();
    },
    SHEET,
    tiles.firstMarked,
  );
  await settle(800);
  const warned = await page.evaluate((sel) => {
    const text = document.querySelector(sel)?.textContent ?? "";
    const m = text.match(/already has a [^.]+\./);
    const button = [...document.querySelector(sel).querySelectorAll("button")].map((b) => b.textContent.trim()).find((t) => /budget$/.test(t));
    return { notice: m?.[0] ?? null, button };
  }, SHEET);
  check(Boolean(warned.notice), `picking "${tiles.firstMarked}" says it already has one`, String(warned.notice));
  check(warned.button === "Update budget", "and the button says Update, not Save", String(warned.button));

  // Saving still produces one budget, not two.
  await tap(page, "Update budget");
  await settle(1500);
  const afterSave = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("owwy");
      r.onsuccess = () => res(r.result);
    });
    const all = await new Promise((res) => {
      const q = db.transaction("budgets", "readonly").objectStore("budgets").getAll();
      q.onsuccess = () => res(q.result);
    });
    return { total: all.length, unique: new Set(all.map((b) => `${b.month}|${b.categoryId}`)).size };
  });
  check(afterSave.total === afterSave.unique && afterSave.total === existing.total, "saving changes the one that was there", `${afterSave.total} budgets`);
  await context.close();
}

/* ================================= 4: the savings target saves as you type */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/safe-to-spend/");

  /**
   * Typing and *not* blurring is the whole point. A decimal keypad has no
   * return key, so on a phone there is nothing on the keyboard that commits
   * a save-on-blur field — which is why the target could not be set at all.
   */
  const typed = await page.evaluate(async () => {
    const label = [...document.querySelectorAll("label")].find((l) => /fixed monthly savings target/i.test(l.textContent || ""));
    const input = label && document.getElementById(label.getAttribute("for"));
    if (!input) return null;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    input.focus();
    setter.call(input, "5000");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1200));
    return { stillFocused: document.activeElement === input, value: input.value };
  });
  check(typed?.stillFocused === true, "the field is still focused — nothing was blurred");

  const saved = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const r = indexedDB.open("owwy");
      r.onsuccess = () => res(r.result);
    });
    const s = await new Promise((res) => {
      const q = db.transaction("settings", "readonly").objectStore("settings").get("app");
      q.onsuccess = () => res(q.result);
    });
    return s.safeToSpend;
  });
  check(saved.monthlySavingsTarget === 500000, "and the target is already saved", `${saved.monthlySavingsTarget} minor units`);

  const feedback = await page.evaluate(() => document.body.innerText.includes("Saved"));
  check(feedback, "with something on screen saying so");

  // Turning "Use my goals" back on clears the field rather than leaving a
  // number that no longer applies.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("label")].find((l) => /Use my goals/i.test(l.textContent || ""));
    row?.closest("div")?.parentElement?.querySelector('[role="switch"]')?.click();
  });
  await settle(1200);
  const cleared = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) => /fixed monthly savings target/i.test(l.textContent || ""));
    const input = label && document.getElementById(label.getAttribute("for"));
    return input?.value ?? null;
  });
  check(cleared === "", "and switching back to goals clears it", JSON.stringify(cleared));

  await page.reload({ waitUntil: "networkidle2" });
  await settle(2000);
  const persisted = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) => /Minimum balance/i.test(l.textContent || ""));
    return Boolean(label);
  });
  check(persisted, "the page still renders after all that");
  await context.close();
}

/* ============================================ 5: not an emoji in sight */
{
  const { page, context, settle } = await phone();

  const ROUTES = [
    "/", "/accounts/", "/transactions/", "/insights/", "/budgets/", "/goals/", "/bills/",
    "/recurring/", "/calendar/", "/debts/", "/owed/", "/shopping/", "/ask/", "/afford/",
    "/safe-to-spend/", "/notes/", "/settings/", "/more/", "/get/", "/review/",
  ];
  // Pictographs only. Arrows, bullets and typographic marks are not emoji.
  const PICTOGRAPH = "[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}]";

  let withEmoji = 0;
  const examples = [];
  for (const route of ROUTES) {
    await go(page, settle, route, 1500);
    const found = await page.evaluate((pattern) => {
      const re = new RegExp(pattern, "u");
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.nodeValue ?? "";
        if (re.test(text)) out.push(text.trim().slice(0, 40));
      }
      return out.slice(0, 3);
    }, PICTOGRAPH);
    if (found.length) {
      withEmoji++;
      examples.push(`${route}: ${found.join(" / ")}`);
    }
  }
  check(withEmoji === 0, `no emoji rendered anywhere across ${ROUTES.length} screens`, examples.slice(0, 3).join(" | "));

  // And the icons are really there, not just absent emoji.
  await go(page, settle, "/budgets/");
  const drawn = await page.evaluate(() => document.querySelectorAll("svg.lucide, svg[class*='lucide']").length);
  check(drawn > 10, "with drawn icons in their place", `${drawn} on the budgets screen`);

  // Opening a picker offers icons, not a grid of emoji.
  await go(page, settle, "/settings/");
  // The settings row's label runs into its description, so this one matches
  // on "starts with" rather than the exact text `tap` uses.
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Categories/.test((b.textContent || "").trim()))?.click());
  await settle(1200);
  const picker = await page.evaluate((sel) => {
    const sheet = [...document.querySelectorAll(sel)].pop();
    const add = [...(sheet?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === "New");
    add?.click();
    return Boolean(add);
  }, SHEET);
  await settle(1200);
  const choices = await page.evaluate((sel) => {
    const sheet = [...document.querySelectorAll(sel)].pop();
    const legend = [...(sheet?.querySelectorAll("legend") ?? [])].find((l) => l.textContent.trim() === "Icon");
    const grid = legend?.nextElementSibling;
    const buttons = [...(grid?.querySelectorAll("button") ?? [])];
    return { count: buttons.length, svg: buttons.filter((b) => b.querySelector("svg")).length, labelled: buttons.filter((b) => (b.getAttribute("aria-label") || "").length > 1).length };
  }, SHEET);
  check(picker && choices.count > 0 && choices.svg === choices.count, "the icon picker offers drawn icons", `${choices.svg}/${choices.count} are svg`);
  check(choices.labelled === choices.count, "each with a name a screen reader can say");

  await context.close();
}

/* ================================================ 6: how Owwy is sold */
{
  const { page, context, settle } = await phone();
  await go(page, settle, "/get/");
  const text = await page.evaluate(() => document.body.innerText);
  check(/199/.test(text), "the page names the one-time price");
  check(/free/i.test(text) && /web/i.test(text), "and is straight about the web version being free");
  check(!/purchase will be available|Restore purchase/i.test(text), "with no in-app purchase flow that cannot happen");

  await go(page, settle, "/more/");
  const more = await page.evaluate(() => document.body.innerText);
  check(!/Owwy Premium/.test(more), "nothing still calls it Premium", more.match(/Premium[^\n]*/)?.[0] ?? "");
  await context.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
