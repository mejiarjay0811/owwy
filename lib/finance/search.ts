import {
  addDays,
  addMonthKey,
  makeDate,
  monthEnd,
  monthKey,
  monthStart,
  parseISODate,
  startOfWeek,
} from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import type { Account, Category, CurrencyCode, ID, ISODate, Minor, Transaction, TransactionType } from "@/types/models";
import { clean, containsPhrase, MONTH_WORD_PATTERN, monthFromWord, normalize, removePhrase, stem } from "./text";

export interface SearchChip {
  kind: "category" | "account" | "type" | "amount" | "date" | "tag" | "text";
  label: string;
}

export interface SearchFilters {
  terms: string[];
  categoryIds: ID[];
  accountIds: ID[];
  types: TransactionType[];
  tags: string[];
  minAmount?: Minor;
  maxAmount?: Minor;
  from?: ISODate;
  to?: ISODate;
  chips: SearchChip[];
}

export interface SearchContext {
  categories: readonly Category[];
  accounts: readonly Account[];
  today: ISODate;
  currency: CurrencyCode;
}

const AMOUNT = "[₱$€£¥]?\\s?[\\d,]+(?:\\.\\d+)?k?";

/**
 * Understands everyday queries:
 * "coffee", "september", "food over ₱500", "transport last month",
 * "income this year", "under 100 cash", "#work".
 */
export function parseSearchQuery(query: string, ctx: SearchContext): SearchFilters {
  const filters: SearchFilters = { terms: [], categoryIds: [], accountIds: [], types: [], tags: [], chips: [] };
  let text = normalize(query);
  if (!text) return filters;

  text = text.replace(/#([\p{L}\p{N}_-]+)/gu, (_, tag: string) => {
    filters.tags.push(tag);
    filters.chips.push({ kind: "tag", label: `#${tag}` });
    return " ";
  });

  const money = (raw: string) => parseAmount(raw.replace(/\s/g, ""), ctx.currency);

  const between = text.match(new RegExp(`\\bbetween (${AMOUNT}) and (${AMOUNT})`));
  if (between) {
    filters.minAmount = money(between[1]) ?? undefined;
    filters.maxAmount = money(between[2]) ?? undefined;
    text = clean(text.replace(between[0], " "));
  }
  const over = text.match(new RegExp(`(?:\\b(?:over|above|more than|greater than|at least|min)|>=?)\\s*(${AMOUNT})`));
  if (over) {
    filters.minAmount = money(over[1]) ?? undefined;
    text = clean(text.replace(over[0], " "));
  }
  const under = text.match(new RegExp(`(?:\\b(?:under|below|less than|at most|max)|<=?)\\s*(${AMOUNT})`));
  if (under) {
    filters.maxAmount = money(under[1]) ?? undefined;
    text = clean(text.replace(under[0], " "));
  }
  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    // Label is rendered by the UI with the user's currency formatting.
    filters.chips.push({ kind: "amount", label: "" });
  }

  const period = extractPeriod(text, ctx.today);
  if (period) {
    filters.from = period.from;
    filters.to = period.to;
    filters.chips.push({ kind: "date", label: period.label });
    text = period.rest;
  }

  const typeWords: [RegExp, TransactionType, string][] = [
    [/\b(income|incomes|earnings|earned|received)\b/, "income", "Income"],
    [/\b(expenses?|spending|spent)\b/, "expense", "Expenses"],
    [/\b(transfers?|moved)\b/, "transfer", "Transfers"],
  ];
  for (const [pattern, type, label] of typeWords) {
    const match = text.match(pattern);
    if (match) {
      filters.types.push(type);
      filters.chips.push({ kind: "type", label });
      text = clean(text.replace(match[0], " "));
    }
  }

  const categories = [...ctx.categories].sort((a, b) => b.name.length - a.name.length);
  for (const category of categories) {
    const name = normalize(category.name);
    const word = text.split(" ").find((w) => stem(w) === stem(name));
    if (containsPhrase(text, name) || word) {
      filters.categoryIds.push(category.id);
      filters.chips.push({ kind: "category", label: `${category.emoji} ${category.name}` });
      text = word && !containsPhrase(text, name) ? removePhrase(text, word) : removePhrase(text, name);
    }
  }

  const accounts = [...ctx.accounts].sort((a, b) => b.name.length - a.name.length);
  for (const account of accounts) {
    const name = normalize(account.name);
    if (name && containsPhrase(text, name)) {
      filters.accountIds.push(account.id);
      filters.chips.push({ kind: "account", label: account.name });
      text = removePhrase(text, name);
    }
  }

  const stop = new Set(["in", "on", "from", "for", "at", "the", "and", "with", "all", "my"]);
  filters.terms = text.split(" ").filter((w) => w && !stop.has(w));
  for (const term of filters.terms) filters.chips.push({ kind: "text", label: `“${term}”` });
  return filters;
}

interface Period {
  from: ISODate;
  to: ISODate;
  label: string;
  rest: string;
}

function extractPeriod(text: string, today: ISODate): Period | null {
  const currentMonth = monthKey(today);
  const { y } = parseISODate(today);
  const relative: [RegExp, () => Omit<Period, "rest">][] = [
    [/\btoday\b/, () => ({ from: today, to: today, label: "Today" })],
    [/\byesterday\b/, () => ({ from: addDays(today, -1), to: addDays(today, -1), label: "Yesterday" })],
    [/\bthis week\b/, () => ({ from: startOfWeek(today), to: today, label: "This week" })],
    [/\blast week\b/, () => {
      const start = addDays(startOfWeek(today), -7);
      return { from: start, to: addDays(start, 6), label: "Last week" };
    }],
    [/\bthis month\b/, () => ({ from: monthStart(currentMonth), to: today, label: "This month" })],
    [/\blast month\b/, () => {
      const m = addMonthKey(currentMonth, -1);
      return { from: monthStart(m), to: monthEnd(m), label: "Last month" };
    }],
    [/\bthis year\b/, () => ({ from: makeDate(y, 1, 1), to: today, label: "This year" })],
    [/\blast year\b/, () => ({ from: makeDate(y - 1, 1, 1), to: makeDate(y - 1, 12, 31), label: "Last year" })],
  ];

  const lastDays = text.match(/\blast (\d{1,3}) days\b/);
  if (lastDays) {
    const n = Math.max(1, Number(lastDays[1]));
    return { from: addDays(today, -(n - 1)), to: today, label: `Last ${n} days`, rest: clean(text.replace(lastDays[0], " ")) };
  }
  for (const [pattern, build] of relative) {
    const match = text.match(pattern);
    if (match) return { ...build(), rest: clean(text.replace(match[0], " ")) };
  }

  const month = text.match(new RegExp(`\\b(${MONTH_WORD_PATTERN})\\b(?:\\s+(\\d{4}))?`));
  if (month) {
    const m = monthFromWord(month[1]);
    if (m) {
      let year = month[2] ? Number(month[2]) : y;
      const key = `${year}-${String(m).padStart(2, "0")}`;
      if (!month[2] && key > currentMonth) year -= 1;
      const finalKey = `${year}-${String(m).padStart(2, "0")}`;
      const label = `${month[1][0].toUpperCase()}${month[1].slice(1)}${month[2] || year !== y ? ` ${year}` : ""}`;
      return { from: monthStart(finalKey), to: monthEnd(finalKey), label, rest: clean(text.replace(month[0], " ")) };
    }
  }
  return null;
}

export interface SearchLookups {
  categoriesById: Map<ID, Category>;
  accountsById: Map<ID, Account>;
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: SearchFilters,
  lookups: SearchLookups,
): Transaction[] {
  const result = transactions.filter((tx) => {
    if (filters.from && tx.date < filters.from) return false;
    if (filters.to && tx.date > filters.to) return false;
    if (filters.types.length && !filters.types.includes(tx.type)) return false;
    if (filters.categoryIds.length && !(tx.categoryId && filters.categoryIds.includes(tx.categoryId))) return false;
    if (
      filters.accountIds.length &&
      !filters.accountIds.includes(tx.accountId) &&
      !(tx.toAccountId && filters.accountIds.includes(tx.toAccountId))
    )
      return false;
    if (filters.minAmount !== undefined && tx.amount < filters.minAmount) return false;
    if (filters.maxAmount !== undefined && tx.amount > filters.maxAmount) return false;
    if (filters.tags.length && !filters.tags.every((t) => tx.tags.map(normalize).includes(t))) return false;
    if (filters.terms.length) {
      const category = tx.categoryId ? lookups.categoriesById.get(tx.categoryId) : undefined;
      const account = lookups.accountsById.get(tx.accountId);
      // Keywords are deliberately excluded: "coffee" should find coffee, not every Food entry.
      const haystack = normalize([tx.note, category?.name, account?.name, tx.tags.join(" ")].filter(Boolean).join(" "));
      if (!filters.terms.every((term) => haystack.includes(term))) return false;
    }
    return true;
  });
  return sortTransactions(result);
}

/** Newest first; same-day entries by creation time. */
export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}
