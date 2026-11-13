import type { ID, ISODate } from "@/types/models";
import { parseSmartInput, type SmartInputContext, type SmartInputResult } from "./smart-input";
import { clean, extractDate, normalize } from "./text";

export interface LogParseResult {
  entries: SmartInputResult[];
  /** Details written once but meant for every entry ("…, gcash"). */
  shared: { accountId: ID | null; date: ISODate | null; dateLabel: string | null };
  /** Plain-language summary, e.g. "That is two transactions, both on GCash." */
  summary: string;
}

const NUMBER_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * Splits "lunch 250 and grab home 120, gcash" or
 * "I spent 50 on food from gcash and 100 on coffee from maya"
 * into separate transactions. Segments without an amount are treated as
 * shared details (an account or date) for the whole sentence.
 */
export function parseLogEntries(text: string, ctx: SmartInputContext): LogParseResult {
  // Split on "and", "then", "also", ";", newlines, and commas that aren't thousands separators.
  const raw = text
    .split(/\s*(?:\band\b|\bthen\b|\balso\b|;|\n|(?<!\d),|,(?!\d{3}(?!\d)))\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments: { text: string; hasAmount: boolean }[] = [];
  for (const segment of raw) {
    const hasAmount = parseSmartInput(segment, ctx).amount !== null;
    segments.push({ text: segment, hasAmount });
  }

  const withAmount = segments.filter((s) => s.hasAmount);
  const shared: LogParseResult["shared"] = { accountId: null, date: null, dateLabel: null };

  // Leftover words either describe shared details or belong to the next item's description.
  const merged: string[] = [];
  let carry = "";
  for (const segment of segments) {
    if (segment.hasAmount) {
      merged.push(clean(`${carry} ${segment.text}`));
      carry = "";
      continue;
    }
    const details = sharedDetails(segment.text, ctx);
    if (details.accountId || details.date) {
      shared.accountId ??= details.accountId;
      if (details.date) {
        shared.date = details.date;
        shared.dateLabel = details.dateLabel;
      }
      if (details.rest) carry = clean(`${carry} ${details.rest}`);
    } else {
      carry = clean(`${carry} ${segment.text}`);
    }
  }
  if (carry && merged.length) merged[merged.length - 1] = clean(`${merged[merged.length - 1]} ${carry}`);

  const pieces = withAmount.length > 1 ? merged : [text];
  const entries = pieces.map((piece) => {
    const entry = parseSmartInput(piece, ctx);
    if (!entry.accountId && shared.accountId) entry.accountId = shared.accountId;
    if (!entry.dateLabel && shared.date) {
      entry.date = shared.date;
      entry.dateLabel = shared.dateLabel;
    }
    return entry;
  });

  return { entries, shared, summary: summarize(entries, ctx) };
}

function sharedDetails(text: string, ctx: SmartInputContext): { accountId: ID | null; date: ISODate | null; dateLabel: string | null; rest: string } {
  let rest = normalize(text).replace(/^(?:from|via|using|with|on|in|paid with|all on|both on)\s+/, "");
  let date: ISODate | null = null;
  let dateLabel: string | null = null;
  const extracted = extractDate(rest, ctx.today);
  if (extracted) {
    date = extracted.date;
    dateLabel = extracted.label;
    rest = extracted.rest;
  }
  const account = ctx.accounts.find((a) => !a.archived && normalize(a.name) === rest.replace(/^(?:from|via|using|with|on|in)\s+/, ""));
  return { accountId: account?.id ?? null, date, dateLabel, rest: account ? "" : date ? rest : text };
}

function summarize(entries: SmartInputResult[], ctx: SmartInputContext): string {
  if (entries.length <= 1) return "";
  const count = NUMBER_WORDS[entries.length] ?? String(entries.length);
  const accounts = new Set(entries.map((e) => e.accountId));
  const sameAccount = accounts.size === 1 && entries[0].accountId;
  const name = sameAccount ? ctx.accounts.find((a) => a.id === entries[0].accountId)?.name : null;
  const allExpenses = entries.every((e) => e.type === "expense");
  const noun = allExpenses ? "expenses" : "transactions";
  if (name) return `That is ${count} ${noun}, ${entries.length === 2 ? "both" : "all"} on ${name}.`;
  return `That is ${count} ${noun}.`;
}
