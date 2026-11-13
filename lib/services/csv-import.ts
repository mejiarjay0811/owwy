import { isValidISODate, makeDate } from "@/lib/dates";
import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from "@/lib/defaults/categories";
import { normalize } from "@/lib/finance/text";
import { parseAmount } from "@/lib/money";
import { getDB } from "@/lib/storage/db";
import { createAccount } from "@/lib/storage/repositories/accounts";
import { buildTransaction, type TransactionInput } from "@/lib/storage/repositories/transactions";
import type { Account, Category, CurrencyCode, ISODate, Transaction, TransactionType } from "@/types/models";

/** RFC 4180-style CSV parsing: quotes, escaped quotes, commas and newlines inside quotes, BOM. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const HEADERS: Record<string, string[]> = {
  date: ["date", "transaction date", "posted", "day"],
  type: ["type", "kind", "transaction type"],
  amount: ["amount", "value", "total", "php", "amount (php)"],
  category: ["category", "categories"],
  account: ["account", "wallet", "from", "source"],
  toAccount: ["to account", "to", "destination"],
  note: ["note", "notes", "description", "memo", "details", "payee", "merchant"],
  tags: ["tags", "labels"],
};

export interface CsvRowResult {
  line: number;
  input?: TransactionInput & { accountName: string };
  error?: string;
}

export interface CsvImportPlan {
  rows: CsvRowResult[];
  valid: number;
  errors: number;
  duplicates: number;
  /** Account names in the file that don't exist yet (they'll be created). */
  newAccounts: string[];
  /** Rows whose category wasn't recognized (they go to Other). */
  uncategorized: number;
  missingColumns: string[];
}

export interface CsvContext {
  accounts: readonly Account[];
  categories: readonly Category[];
  transactions: readonly Transaction[];
  currency: CurrencyCode;
  today: ISODate;
}

/**
 * Turns CSV text into a reviewable import plan. Works with Owwy's own export
 * and most bank or app exports that have date, amount and a description.
 */
export function planCsvImport(text: string, ctx: CsvContext): CsvImportPlan {
  const [header = [], ...body] = parseCSV(text);
  const columns = header.map((h) => normalize(h));
  const index = (key: keyof typeof HEADERS) => columns.findIndex((c) => HEADERS[key].includes(c));
  const col = { date: index("date"), type: index("type"), amount: index("amount"), category: index("category"), account: index("account"), toAccount: index("toAccount"), note: index("note"), tags: index("tags") };
  const missingColumns = [col.date < 0 ? "Date" : null, col.amount < 0 ? "Amount" : null].filter((c): c is string => Boolean(c));

  const accountsByName = new Map(ctx.accounts.map((a) => [normalize(a.name), a]));
  const categoriesByName = new Map(ctx.categories.map((c) => [`${c.kind}:${normalize(c.name)}`, c]));
  const existing = new Set(ctx.transactions.map((t) => fingerprint(t.date, t.amount, t.note, ctx.accounts.find((a) => a.id === t.accountId)?.name ?? "")));
  const newAccounts = new Set<string>();
  let uncategorized = 0;
  let duplicates = 0;

  const rows: CsvRowResult[] = missingColumns.length
    ? []
    : body.map((cells, i) => {
        const line = i + 2;
        const cell = (c: number) => (c >= 0 ? (cells[c] ?? "").trim() : "");
        const date = parseDate(cell(col.date));
        if (!date) return { line, error: `Unrecognized date “${cell(col.date)}”` };

        const rawAmount = cell(col.amount).replace(/[()]/g, (m) => (m === "(" ? "-" : ""));
        const negative = /^-|−/.test(rawAmount);
        const amount = parseAmount(rawAmount.replace(/^[-−+]/, ""), ctx.currency);
        if (!amount) return { line, error: `Unrecognized amount “${cell(col.amount)}”` };

        const typeText = normalize(cell(col.type));
        const type: TransactionType = typeText.startsWith("trans") ? "transfer" : typeText.startsWith("inc") || typeText === "credit" ? "income" : typeText.startsWith("exp") || typeText === "debit" ? "expense" : negative ? "expense" : "income";

        const accountName = cell(col.account) || "Imported";
        if (!accountsByName.has(normalize(accountName))) newAccounts.add(accountName);

        let categoryId: string | undefined;
        let toAccountId: string | undefined;
        if (type === "transfer") {
          const toName = cell(col.toAccount);
          if (!toName) return { line, error: "Transfer without a destination account" };
          const to = accountsByName.get(normalize(toName));
          if (!to) newAccounts.add(toName);
          toAccountId = to?.id ?? `new:${toName}`;
        } else {
          const category = categoriesByName.get(`${type}:${normalize(cell(col.category))}`);
          if (!category) uncategorized++;
          categoryId = category?.id ?? (type === "income" ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID);
        }

        const note = cell(col.note).slice(0, 140);
        if (existing.has(fingerprint(date, amount, note, accountName))) {
          duplicates++;
          return { line, error: "Already in Owwy (skipped)" };
        }
        const tags = cell(col.tags).split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
        return { line, input: { type, amount, accountId: accountsByName.get(normalize(accountName))?.id ?? `new:${accountName}`, accountName, toAccountId, categoryId, date, note, tags } };
      });

  const valid = rows.filter((r) => r.input).length;
  return { rows, valid, errors: rows.length - valid - duplicates, duplicates, newAccounts: [...newAccounts], uncategorized, missingColumns };
}

/** Creates any new accounts, then adds every valid row in one transaction. */
export async function applyCsvImport(plan: CsvImportPlan): Promise<number> {
  const created = new Map<string, string>();
  for (const name of plan.newAccounts) {
    const account = await createAccount({ name: name.slice(0, 40), type: "other", openingBalance: 0 });
    created.set(`new:${name}`, account.id);
  }
  const resolve = (id: string | undefined) => (id && id.startsWith("new:") ? created.get(id) : id);
  const transactions = plan.rows
    .filter((r): r is Required<Pick<CsvRowResult, "input">> & CsvRowResult => Boolean(r.input))
    .map((r, i) => buildTransaction({ ...r.input, accountId: resolve(r.input.accountId)!, toAccountId: resolve(r.input.toAccountId) }, Date.now() + i));
  const db = getDB();
  await db.transaction("rw", db.transactions, async () => {
    await db.transactions.bulkAdd(transactions);
  });
  return transactions.length;
}

function fingerprint(date: string, amount: number, note: string, account: string): string {
  return `${date}|${amount}|${normalize(note)}|${normalize(account)}`;
}

/** Accepts 2026-09-14, 2026/09/14, 09/14/2026, 14/09/2026 (when unambiguous), Sep 14 2026. */
export function parseDate(value: string): ISODate | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a > 12 ? valid(year, b, a) : valid(year, a, b);
  }
  const parsed = Date.parse(v);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return valid(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

function valid(y: number, m: number, d: number): ISODate | null {
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidISODate(iso) ? makeDate(y, m, d) : null;
}
