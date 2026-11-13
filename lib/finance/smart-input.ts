import { parseAmount } from "@/lib/money";
import type { Account, Category, CurrencyCode, ID, ISODate, Minor, TransactionType } from "@/types/models";
import { capitalize, clean, containsPhrase, extractDate, normalize, removePhrase, stem } from "./text";

export interface SmartInputContext {
  categories: readonly Category[];
  accounts: readonly Account[];
  today: ISODate;
  currency: CurrencyCode;
}

export type SmartInputNeed = "amount" | "category" | "type";

export interface SmartInputResult {
  amount: Minor | null;
  type: TransactionType;
  /** Whether the type came from an explicit signal (+, "salary", "transfer"). */
  typeConfident: boolean;
  description: string;
  categoryId: ID | null;
  /** Equally likely categories when Owwy isn't sure, best first. */
  categoryCandidates: ID[];
  accountId: ID | null;
  toAccountId: ID | null;
  date: ISODate;
  dateLabel: string | null;
  tags: string[];
  /** What the user still needs to confirm. */
  needs: SmartInputNeed[];
}

const INCOME_SIGNALS = ["received", "got paid", "earned", "income", "salary", "payday", "sweldo", "refund", "cashback"];
const TRANSFER_SIGNALS = ["transfer", "transferred", "move", "moved", "top up", "topup", "top-up", "cash in", "cashin", "withdraw", "withdrew"];
const FILLER = new Set(["for", "at", "on", "in", "spent", "paid", "pay", "bought", "buy", "the", "a", "an", "of", "from", "to", "via", "using", "with", "my", "sa", "ng", "account", "acct", "i"]);

/** Matches standalone amounts: 180, 1,240.50, ₱1.2k, $30 — but not "7-eleven" or "2nd". */
const AMOUNT_PATTERN = /(?<![\p{L}\p{N}\-/])([+-]?)([₱$€£¥]|php|usd)?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(k|m)?(?![\p{L}\p{N}\-/])/giu;

export interface CategoryMatch {
  categoryId: ID;
  score: number;
}

/**
 * Scores categories against free text — a typed sentence, a receipt's merchant,
 * its line items. Exact names beat keywords; longer keywords beat shorter ones.
 */
export function scoreCategories(text: string, categories: readonly Category[], kind?: Category["kind"]): CategoryMatch[] {
  const scores = new Map<ID, number>();
  const words = text.split(" ").filter(Boolean);
  const stems = new Set(words.map(stem));
  for (const category of categories) {
    if (category.archived) continue;
    if (kind && category.kind !== kind) continue;
    let score = 0;
    const name = normalize(category.name);
    if (containsPhrase(text, name) || stems.has(stem(name))) score = Math.max(score, 5);
    for (const keyword of category.keywords) {
      const k = normalize(keyword);
      if (containsPhrase(text, k)) score = Math.max(score, 3 + k.split(" ").length);
      else if (!k.includes(" ") && stems.has(stem(k))) score = Math.max(score, 3);
      else if (k.length >= 5 && words.some((w) => w.length >= 5 && w.startsWith(k))) score = Math.max(score, 2);
    }
    if (score > 0) scores.set(category.id, score);
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([categoryId, score]) => ({ categoryId, score }));
}

export function parseSmartInput(input: string, ctx: SmartInputContext): SmartInputResult {
  const tags: string[] = [];
  let text = normalize(input).replace(/#([\p{L}\p{N}_-]+)/gu, (_, tag: string) => {
    tags.push(tag);
    return " ";
  });

  let explicitType: TransactionType | null = null;
  if (/^\+/.test(text)) explicitType = "income";

  // Date first so "sep 12" isn't read as the amount 12.
  let date = ctx.today;
  let dateLabel: string | null = null;
  const extracted = extractDate(text, ctx.today);
  if (extracted) {
    date = extracted.date;
    dateLabel = extracted.label;
    text = extracted.rest;
  }

  // Amount: prefer one with a currency symbol, otherwise the largest number.
  const amounts: { minor: Minor; raw: string; hasSymbol: boolean; sign: string }[] = [];
  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const minor = parseAmount(`${match[3]}${match[4] ?? ""}${match[5] ?? ""}`, ctx.currency);
    if (minor !== null && minor > 0) amounts.push({ minor, raw: match[0], hasSymbol: Boolean(match[2]), sign: match[1] });
  }
  const chosen = amounts.find((a) => a.hasSymbol) ?? [...amounts].sort((a, b) => b.minor - a.minor)[0];
  if (chosen) {
    if (chosen.sign === "+") explicitType = "income";
    text = clean(text.replace(chosen.raw, " "));
  }

  if (!explicitType && TRANSFER_SIGNALS.some((s) => containsPhrase(text, s))) explicitType = "transfer";
  if (!explicitType && INCOME_SIGNALS.some((s) => containsPhrase(text, s))) explicitType = "income";

  // Accounts: "from bank to savings", "via gcash", or a bare account name.
  let accountId: ID | null = null;
  let toAccountId: ID | null = null;
  const accounts = ctx.accounts
    .filter((a) => !a.archived)
    .map((a) => ({ account: a, name: normalize(a.name) }))
    .sort((a, b) => b.name.length - a.name.length);

  for (const { account, name } of accounts) {
    if (!name) continue;
    // "to savings", "into my BPI savings account"
    const toMatch = text.match(new RegExp(`\\b(?:to|into)(?: my| the)? ${escape(name)}(?: account)?\\b`));
    if (toMatch && !toAccountId) {
      toAccountId = account.id;
      text = clean(text.replace(toMatch[0], " "));
      continue;
    }
    if (!accountId && containsPhrase(text, name)) {
      accountId = account.id;
      text = removePhrase(text, name);
    }
  }
  if (toAccountId && accountId) explicitType = "transfer";

  const ranked = scoreCategories(text, ctx.categories, explicitType === "income" ? "income" : undefined).map((m) => [m.categoryId, m.score] as const);
  const top = ranked[0]?.[1] ?? 0;
  const best = ranked.filter(([, s]) => s === top).map(([id]) => id);
  const categoryId = best.length === 1 && explicitType !== "transfer" ? best[0] : null;
  const categoryCandidates = explicitType === "transfer" ? [] : best.length > 1 ? best : ranked.slice(0, 3).map(([id]) => id);

  let type: TransactionType = explicitType ?? "expense";
  if (!explicitType && categoryId) {
    const category = ctx.categories.find((c) => c.id === categoryId);
    if (category?.kind === "income") type = "income";
  }

  const description = capitalize(
    text
      .split(" ")
      .filter((w) => w && !FILLER.has(w))
      .join(" "),
  );

  const needs: SmartInputNeed[] = [];
  if (!chosen) needs.push("amount");
  if (type !== "transfer" && !categoryId) needs.push("category");

  return {
    amount: chosen?.minor ?? null,
    type,
    typeConfident: explicitType !== null,
    description,
    categoryId: type === "transfer" ? null : categoryId,
    categoryCandidates,
    accountId,
    toAccountId,
    date,
    dateLabel,
    tags,
    needs,
  };
}

/**
 * Finds the bill a logged expense is paying: "paid 3,421 for my electric bill"
 * matches a bill named "Electricity". Word stems of 5+ letters are enough.
 */
export function matchBill<T extends { id: string; name: string; active: boolean }>(text: string, bills: readonly T[]): T | undefined {
  const words = normalize(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
  let best: { bill: T; score: number } | undefined;
  for (const bill of bills) {
    if (!bill.active) continue;
    const name = normalize(bill.name);
    let score = containsPhrase(normalize(text), name) ? 3 : 0;
    if (!score) {
      for (const token of name.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4)) {
        const stemLength = Math.min(token.length, 6);
        if (words.some((w) => w.length >= 5 && (w.startsWith(token.slice(0, stemLength)) || token.startsWith(w)))) score = Math.max(score, 2);
      }
    }
    if (score && (!best || score > best.score)) best = { bill, score };
  }
  return best?.bill;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
