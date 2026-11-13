import { diffDays, isValidISODate, makeDate } from "@/lib/dates";
import { monthFromWord } from "@/lib/finance/text";
import { toMinor } from "@/lib/money";
import { getCurrency } from "@/lib/money/currency";
import type { CurrencyCode, ISODate, Minor } from "@/types/models";

export interface ReceiptItem {
  label: string;
  amount: Minor;
}

export interface ParsedReceipt {
  /** Shop name, as printed at the top. */
  merchant: string | null;
  total: Minor | null;
  /** The line the total was read from, e.g. "TOTAL DUE 1,234.00". */
  totalLine: string | null;
  /**
   * A total was found, but it doesn't add up — it's smaller than one of the
   * lines above it. Worth showing, worth flagging, never worth trusting.
   */
  totalLooksOff: boolean;
  date: ISODate | null;
  items: ReceiptItem[];
  /** Raw text the OCR engine produced. */
  text: string;
  /** 0–1: how much of the receipt Owwy could read with confidence. */
  confidence: number;
}

/** Lines that hold a number but never the amount actually paid. */
const NOT_A_TOTAL = [
  "subtotal", "sub total", "sub-total", "vat", "vatable", "zero rated", "zero-rated", "exempt", "net of",
  "tax", "change", "cash", "tendered", "tender", "discount", "savings", "saved", "qty", "quantity",
  "items", "item count", "points", "reward", "loyalty", "tin", "or no", "invoice", "terminal", "batch",
  "ref no", "reference", "card no", "account no", "phone", "tel", "serial", "approval", "auth",
  "count", "no of", "number of", "voucher", "balance point",
];

/**
 * Words above that only disqualify a line on their own: "Total (VAT inclusive)"
 * is still the total, while "Total VAT" is not.
 */
const SOFTENED_BY_INCLUSIVE = new Set(["vat", "vatable", "tax", "net of", "zero rated", "zero-rated", "exempt"]);

/** Total keywords, strongest first. */
const TOTAL_KEYWORDS: { phrase: string; weight: number }[] = [
  { phrase: "grand total", weight: 100 },
  { phrase: "total due", weight: 95 },
  { phrase: "amount due", weight: 95 },
  { phrase: "balance due", weight: 92 },
  { phrase: "total amount", weight: 90 },
  { phrase: "amount paid", weight: 85 },
  { phrase: "total payment", weight: 85 },
  { phrase: "net total", weight: 82 },
  { phrase: "total", weight: 80 },
  { phrase: "amount", weight: 50 },
];

const HEADER_NOISE = [
  "official receipt", "sales invoice", "invoice", "receipt", "welcome", "thank you", "customer copy",
  "store copy", "tin", "vat reg", "permit", "machine", "serial", "branch", "www.", "http",
];

/**
 * One number as printed on a receipt: 1,234.00 · 1 234,00 · 89.50 · 1234.
 *
 * Spaces group thousands only in the "1 234,00" convention, which pairs them
 * with a comma decimal. A space beside a dot decimal is the gap in "soap 2
 * 64.00" — a quantity standing next to its price, not one number.
 */
const AMOUNT_TOKEN = /-?[₱$€£¥]?\s?\d{1,3}(?: \d{3})+(?:,\d{1,2})?(?![\d.,])|-?[₱$€£¥]?\s?\d[\d.,]*\d|-?[₱$€£¥]?\s?\d/g;

/** The same pattern, for asking where the first number starts. */
const FIRST_AMOUNT = new RegExp(AMOUNT_TOKEN.source);

/** Receipts line their columns up with wide gaps; a single space can be part of a number. */
const COLUMN_GAP = /\s{2,}/;

function normalizeLine(line: string): string {
  return line.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Reads a printed amount, tolerating OCR noise: "P 1,234.00", "1 234,00",
 * "1.234,00" and stray letters. Returns minor units.
 */
export function parseReceiptAmount(raw: string, currency: CurrencyCode): Minor | null {
  const decimals = getCurrency(currency).decimals;
  let text = raw
    .toLowerCase()
    .replace(/[₱$€£¥]/g, "")
    .replace(/\b(php|usd|eur|gbp|sgd|aud|cad|jpy|p)\b/g, "")
    // OCR often reads O as 0 and l as 1 inside numbers.
    .replace(/(?<=\d)[ol](?=\d)|(?<=^|\s)[ol](?=\d)/g, (m) => (m === "o" ? "0" : "1"))
    .replace(/[^\d.,\- ]/g, "")
    .trim();
  if (!text) return null;

  const negative = text.startsWith("-");
  text = text.replace(/-/g, "").trim();
  // A space only groups thousands in the "1 234,00" convention. Anything else
  // with a space in it is two numbers that happened to land side by side.
  if (text.includes(" ")) {
    if (!/^\d{1,3}(?: \d{3})+(?:,\d{1,2})?$/.test(text)) return null;
    text = text.replace(/ /g, "");
  }
  // Decimals are the last "." or "," with 1–2 digits after.
  const decimalMatch = decimals > 0 ? text.match(/[.,](\d{1,2})$/) : null;
  const fraction = decimalMatch ? decimalMatch[1].padEnd(decimals, "0").slice(0, decimals) : "";
  const wholeText = (decimalMatch ? text.slice(0, -decimalMatch[0].length) : text).replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(wholeText)) return null;
  // A "whole" part longer than 9 digits is OCR noise, not money.
  if (wholeText.length > 9) return null;

  const value = Number(`${wholeText}.${fraction || "0"}`);
  if (!Number.isFinite(value)) return null;
  const minor = toMinor(value, currency);
  return negative ? -minor : minor;
}

/**
 * Every amount printed on a line, left to right. The line is split on its
 * column gaps first, so a quantity in one column can't merge with the price in
 * the next.
 */
export function amountsOn(line: string, currency: CurrencyCode): Minor[] {
  const found: Minor[] = [];
  for (const column of line.split(COLUMN_GAP)) {
    for (const match of column.match(AMOUNT_TOKEN) ?? []) {
      const minor = parseReceiptAmount(match, currency);
      if (minor !== null && minor > 0) found.push(minor);
    }
  }
  return found;
}

/** What a line says before its first number: "TOTAL", "TOTAL ITEMS", "VAT 12%" → "vat". */
function labelOf(line: string): string {
  const at = line.search(FIRST_AMOUNT);
  return normalizeLine(at < 0 ? line : line.slice(0, at));
}

/** True when the label names something other than what you actually paid. */
function disqualified(label: string): boolean {
  return NOT_A_TOTAL.some((word) => label.includes(word) && !ignorable(word, label));
}

/** "(VAT inclusive)" qualifies a total rather than replacing it. */
function ignorable(word: string, text: string): boolean {
  return text.includes("incl") && SOFTENED_BY_INCLUSIVE.has(word);
}

/**
 * The amounts on a total line that could be the total. Anything printed after
 * a word like "cash" or "change" belongs to that word, not to the total.
 */
function payableAmounts(line: string, keyword: string, currency: CurrencyCode): Minor[] {
  const lower = line.toLowerCase();
  const at = lower.indexOf(keyword);
  const after = at >= 0 ? at + keyword.length : 0;
  let cut = line.length;
  for (const word of NOT_A_TOTAL) {
    if (ignorable(word, lower)) continue;
    const found = lower.indexOf(word, after);
    if (found >= 0) cut = Math.min(cut, found);
  }
  return amountsOn(line.slice(0, cut), currency);
}

function looksLikeDateOrTime(line: string): boolean {
  return /\d{1,2}[:/-]\d{2}/.test(line);
}

/** A printed date, if one is plausible: not in the future, not ancient. */
export function findReceiptDate(lines: readonly string[], today: ISODate): ISODate | null {
  const candidates: ISODate[] = [];
  const add = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!isValidISODate(iso)) return;
    const date = makeDate(y, m, d);
    const ahead = diffDays(today, date);
    if (ahead > 1 || ahead < -730) return;
    candidates.push(date);
  };

  for (const line of lines) {
    const text = normalizeLine(line);
    for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) add(Number(m[1]), Number(m[2]), Number(m[3]));
    for (const m of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const year = Number(m[3]);
      // 25/12 can only be day/month; otherwise assume month/day, then fall back.
      if (a > 12) add(year, b, a);
      else {
        add(year, a, b);
        if (b <= 12) add(year, b, a);
      }
    }
    for (const m of text.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/g)) {
      const month = monthFromWord(m[1]);
      if (month) add(Number(m[3]), month, Number(m[2]));
    }
    for (const m of text.matchAll(/\b(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{2,4})\b/g)) {
      const month = monthFromWord(m[2]);
      if (month) add(Number(m[3]), month, Number(m[1]));
    }
  }
  // The most recent plausible date is usually the transaction date.
  return candidates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

const SMALL_WORDS = new Set(["the", "and", "of", "for", "at", "de", "by"]);

/** "PUREGOLD PRICE CLUB INC." → "Puregold Price Club Inc.", keeping "SM" and "KFC" as they are. */
function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word, index) => {
      const letters = word.replace(/[^\p{L}]/gu, "");
      if (letters.length <= 3) return word;
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower.replace(/[^\p{L}]/gu, ""))) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .trim();
}

/** The shop name, usually the first real line of the receipt. */
export function findMerchant(lines: readonly string[]): string | null {
  for (const raw of lines.slice(0, 6)) {
    const line = raw.replace(/[*=_~|]+/g, " ").replace(/\s+/g, " ").trim();
    if (line.length < 3 || line.length > 42) continue;
    const letters = line.replace(/[^\p{L}]/gu, "").length;
    if (letters < 3 || letters / line.length < 0.55) continue;
    const lower = line.toLowerCase();
    if (HEADER_NOISE.some((noise) => lower.includes(noise))) continue;
    if (/\d{4,}/.test(line) || looksLikeDateOrTime(line)) continue;
    return /[a-z]/.test(line) ? line : titleCase(line);
  }
  return null;
}

/**
 * Turns raw OCR text into the few things Owwy needs: who you paid, how much,
 * when, and what was on the receipt. Everything stays on the device.
 */
export function parseReceipt(text: string, options: { currency: CurrencyCode; today: ISODate }): ParsedReceipt {
  const { currency, today } = options;
  // Keep the spacing: the gaps between columns are what tell an item apart
  // from its price. Only trim the ends.
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]/g, " ").trim())
    .filter(Boolean);

  const merchant = findMerchant(lines);
  const date = findReceiptDate(lines, today);

  // Line items: a label with a price at the end.
  const items: ReceiptItem[] = [];
  for (const line of lines) {
    if (items.length >= 25) break;
    const lower = normalizeLine(line);
    if (NOT_A_TOTAL.some((word) => lower.includes(word))) continue;
    if (TOTAL_KEYWORDS.some((k) => lower.includes(k.phrase))) continue;
    if (looksLikeDateOrTime(line)) continue;
    const amounts = amountsOn(line, currency);
    if (!amounts.length) continue;
    const label = line
      .replace(AMOUNT_TOKEN, " ")
      .replace(/[₱$€£¥*x#@]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (label.replace(/[^\p{L}]/gu, "").length < 3) continue;
    // The rightmost number is the price; anything before it is a quantity.
    items.push({ label, amount: amounts[amounts.length - 1] });
  }
  const largestItem = items.reduce((max, item) => Math.max(max, item.amount), 0);

  // Every line that names a total and carries a number.
  const candidates: { amount: Minor; line: string; weight: number; index: number; plausible: boolean }[] = [];
  lines.forEach((line, index) => {
    const label = labelOf(line);
    if (!label) return;
    const keyword = TOTAL_KEYWORDS.find((k) => label.includes(k.phrase));
    if (!keyword || disqualified(label)) return;
    const amounts = payableAmounts(line, keyword.phrase, currency);
    if (!amounts.length) return;
    const amount = Math.max(...amounts);
    candidates.push({
      amount,
      line: normalizeLine(line),
      weight: keyword.weight,
      index,
      // A total can't be smaller than one of the lines it adds up. When it is,
      // the number was misread — or the label meant something else.
      plausible: items.length < 2 || amount >= largestItem,
    });
  });

  // Strongest wording first, a believable figure ahead of a doubtful one, and
  // the earliest line to break a tie: trailing summaries come after the total.
  const best = candidates.sort((a, b) => Number(b.plausible) - Number(a.plausible) || b.weight - a.weight || a.index - b.index)[0];

  let total: Minor | null = best?.amount ?? null;
  let totalLine: string | null = best?.line ?? null;
  const fromKeyword = Boolean(best?.plausible);

  // No "total" line: the largest amount on the receipt is the usual fallback.
  if (total === null && items.length) {
    total = largestItem || null;
    totalLine = null;
  }

  const looksOff = Boolean(best) && !best.plausible;
  let confidence = 0;
  if (total !== null) confidence += fromKeyword ? 0.5 : 0.25;
  if (merchant) confidence += 0.2;
  if (date) confidence += 0.15;
  if (items.length >= 2) confidence += 0.15;
  // Reading the shop and the date well doesn't make a total that can't be right
  // any more believable — the amount is the part that matters.
  if (looksOff) confidence = Math.min(confidence, 0.4);

  return {
    merchant,
    total,
    totalLine,
    totalLooksOff: looksOff,
    date,
    items,
    text,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
}
