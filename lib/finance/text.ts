import { addDays, dayOfWeek, isValidISODate, makeDate, MONTH_NAMES, parseISODate } from "@/lib/dates";
import type { ISODate } from "@/types/models";

/** Shared text helpers for smart input and search. */

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches `phrase` as whole words inside `text` (both normalized). */
export function phraseRegExp(phrase: string): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escapeRegExp(phrase)})(?=$|[^\\p{L}\\p{N}])`, "u");
}

export function containsPhrase(text: string, phrase: string): boolean {
  return phraseRegExp(phrase).test(text);
}

export function removePhrase(text: string, phrase: string): string {
  return text.replace(phraseRegExp(phrase), (match, word: string) => match.replace(word, " ")).replace(/\s+/g, " ").trim();
}

const MONTH_LOOKUP = new Map<string, number>();
MONTH_NAMES.forEach((name, index) => {
  MONTH_LOOKUP.set(name.toLowerCase(), index + 1);
  MONTH_LOOKUP.set(name.slice(0, 3).toLowerCase(), index + 1);
});
MONTH_LOOKUP.set("sept", 9);

export function monthFromWord(word: string): number | undefined {
  return MONTH_LOOKUP.get(word.toLowerCase());
}

export const MONTH_WORD_PATTERN =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export interface ExtractedDate {
  date: ISODate;
  label: string;
  rest: string;
}

/**
 * Pulls a single date expression out of free text:
 * today, yesterday, kahapon, last night, weekday names, "sep 12", "12 sep", "9/12".
 * Returns null when no date expression is found.
 */
export function extractDate(text: string, today: ISODate): ExtractedDate | null {
  const simple: [RegExp, number, string][] = [
    [/\b(today|tonight|this morning|ngayon)\b/, 0, "Today"],
    [/\b(yesterday|last night|kahapon)\b/, -1, "Yesterday"],
    [/\b(day before yesterday)\b/, -2, "2 days ago"],
  ];
  // Check the longer phrase first so "day before yesterday" isn't read as "yesterday".
  for (const [pattern, offset, label] of [simple[2], simple[0], simple[1]]) {
    const match = text.match(pattern);
    if (match) return { date: addDays(today, offset), label, rest: clean(text.replace(match[0], " ")) };
  }

  const weekday = text.match(new RegExp(`\\b(?:last |on )?(${WEEKDAYS.join("|")}|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\\b`));
  if (weekday) {
    const token = weekday[1];
    const index = WEEKDAYS.findIndex((d) => d.startsWith(token.slice(0, 3)));
    if (index >= 0) {
      const back = (dayOfWeek(today) - index + 7) % 7 || (weekday[0].startsWith("last") ? 7 : 0);
      const date = addDays(today, -back);
      return { date, label: WEEKDAYS[index][0].toUpperCase() + WEEKDAYS[index].slice(1), rest: clean(text.replace(weekday[0], " ")) };
    }
  }

  const monthDay = text.match(new RegExp(`\\b(?:on )?(${MONTH_WORD_PATTERN})\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b`));
  const dayMonth = text.match(new RegExp(`\\b(?:on )?(\\d{1,2})(?:st|nd|rd|th)? (${MONTH_WORD_PATTERN})\\b`));
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);

  const candidates: { m: number; d: number; raw: string }[] = [];
  if (monthDay) candidates.push({ m: monthFromWord(monthDay[1]) ?? 0, d: Number(monthDay[2]), raw: monthDay[0] });
  if (dayMonth) candidates.push({ m: monthFromWord(dayMonth[2]) ?? 0, d: Number(dayMonth[1]), raw: dayMonth[0] });
  if (slash) candidates.push({ m: Number(slash[1]), d: Number(slash[2]), raw: slash[0] });

  for (const c of candidates) {
    const { y } = parseISODate(today);
    let date = makeDate(y, c.m, c.d);
    const candidate = `${y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
    if (!isValidISODate(candidate)) continue;
    // Entries are about the past: a future date this year most likely meant last year.
    if (date > today) date = makeDate(y - 1, c.m, c.d);
    return { date, label: date, rest: clean(text.replace(c.raw, " ")) };
  }
  return null;
}

export function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Simple singularization so "coffees" and "groceries" still match keywords. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("es") && /(sh|ch|x|z|s)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}
