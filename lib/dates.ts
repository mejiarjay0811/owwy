import type { Frequency, ISODate, MonthKey } from "@/types/models";

/**
 * Date helpers operating on local `YYYY-MM-DD` strings.
 * Internally uses UTC `Date` objects purely as calendar arithmetic, so results
 * never shift because of time zones or daylight saving.
 */

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function parseISODate(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function toUTC(date: ISODate): Date {
  const { y, m, d } = parseISODate(date);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): ISODate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function makeDate(y: number, m: number, d: number): ISODate {
  return fromUTC(new Date(Date.UTC(y, m - 1, d)));
}

/** Today's local calendar date. */
export function today(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUTC(toUTC(value)) === value;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(new Date(toUTC(date).getTime() + days * DAY_MS));
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Adds months keeping an anchor day, clamped to the month length:
 * Jan 31 + 1 month → Feb 28/29, and with anchorDay 31 → Mar 31 afterwards.
 */
export function addMonths(date: ISODate, months: number, anchorDay?: number): ISODate {
  const { y, m, d } = parseISODate(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

export function addYears(date: ISODate, years: number, anchorDay?: number): ISODate {
  return addMonths(date, years * 12, anchorDay);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / DAY_MS);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function isBetween(date: ISODate, start: ISODate, end: ISODate): boolean {
  return date >= start && date <= end;
}

export function monthKey(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function monthStart(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function monthEnd(month: MonthKey): ISODate {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${pad(daysInMonth(y, m))}`;
}

export function addMonthKey(month: MonthKey, delta: number): MonthKey {
  return monthKey(addMonths(monthStart(month), delta));
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: ISODate): number {
  return toUTC(date).getUTCDay();
}

export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const dow = dayOfWeek(date);
  const offset = (dow - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

/**
 * Resolves a chosen day-of-month against a real month: 31 means "last day",
 * and a 30th in February lands on the 28th rather than disappearing.
 */
export function dayInMonth(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

/** The chosen days of a month as real dates, in order and without duplicates. */
export function monthDayDates(month: MonthKey, days: readonly number[]): ISODate[] {
  const [y, m] = month.split("-").map(Number);
  return [...new Set(days.map((d) => dayInMonth(y, m, d)))].sort();
}

/**
 * The first chosen day-of-month strictly after `date`, rolling into the next
 * month when the current one is used up. Returns null when no day is chosen.
 */
function nextMonthDay(date: ISODate, days: readonly number[]): ISODate | null {
  const valid = days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31);
  if (!valid.length) return null;
  // Two months is always enough: one to finish, one to wrap into. Clamping
  // can collide (30 and 31 both land on Feb 28), hence the strict compare.
  for (const month of [monthKey(date), addMonthKey(monthKey(date), 1)]) {
    for (const candidate of monthDayDates(month, valid)) {
      if (candidate > date) return candidate;
    }
  }
  return null;
}

/** Advances a date by one period of `frequency`. `once` returns null. */
export function nextOccurrence(date: ISODate, frequency: Frequency, anchorDay?: number, monthDays?: readonly number[]): ISODate | null {
  switch (frequency) {
    case "once":
      return null;
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addDays(date, 7);
    case "biweekly":
      return addDays(date, 14);
    case "monthly":
      return addMonths(date, 1, anchorDay);
    case "monthDays":
      return nextMonthDay(date, monthDays ?? []);
    case "quarterly":
      return addMonths(date, 3, anchorDay);
    case "yearly":
      return addYears(date, 1, anchorDay);
  }
}

/** All occurrences from `start` (inclusive) up to `end` (inclusive). */
export function occurrencesBetween(
  start: ISODate,
  frequency: Frequency,
  from: ISODate,
  to: ISODate,
  anchorDay?: number,
  limit = 400,
  monthDays?: readonly number[],
): ISODate[] {
  const result: ISODate[] = [];
  let current: ISODate | null = start;
  let guard = 0;
  while (current && current <= to && guard < limit) {
    if (current >= from) result.push(current);
    current = nextOccurrence(current, frequency, anchorDay, monthDays);
    guard++;
  }
  return result;
}

/**
 * The first date on or after `from` that a `monthDays` rule fires. Used when
 * the chosen days change, so the rule jumps to the right next date instead of
 * waiting out the old one.
 */
export function firstMonthDayOnOrAfter(from: ISODate, days: readonly number[]): ISODate | null {
  const valid = days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 31);
  if (!valid.length) return null;
  for (const month of [monthKey(from), addMonthKey(monthKey(from), 1)]) {
    for (const candidate of monthDayDates(month, valid)) {
      if (candidate >= from) return candidate;
    }
  }
  return null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_NAMES = MONTHS;

export function monthName(month: MonthKey, short = false): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1] ?? "";
  return short ? name.slice(0, 3) : name;
}

export function formatMonth(month: MonthKey, withYear = true): string {
  return withYear ? `${monthName(month)} ${month.slice(0, 4)}` : monthName(month);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(date: ISODate, short = false): string {
  const name = WEEKDAYS[dayOfWeek(date)];
  return short ? name.slice(0, 3) : name;
}

/** "Sep 15" or "Sep 15, 2025" when the year differs from `reference`. */
export function formatShortDate(date: ISODate, reference?: ISODate): string {
  const { y, m, d } = parseISODate(date);
  const base = `${MONTHS[m - 1].slice(0, 3)} ${d}`;
  if (reference && parseISODate(reference).y !== y) return `${base}, ${y}`;
  return base;
}

/** Friendly relative labels: Today, Tomorrow, Yesterday, In 3 days, Mon, Sep 15. */
export function formatRelativeDate(date: ISODate, reference: ISODate): string {
  const diff = diffDays(reference, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return formatShortDate(date, reference);
}

/** formatRelativeDate for mid-sentence use: "today", "in 3 days" — month names keep their capital ("Sep 30"). */
export function relativeDatePhrase(date: ISODate, reference: ISODate): string {
  const label = formatRelativeDate(date, reference);
  return /^[A-Z][a-z]{2} \d/.test(label) ? label : label.toLowerCase();
}

/** Heading for a group of transactions on the same day. */
export function formatDayHeading(date: ISODate, reference: ISODate): string {
  const diff = diffDays(reference, date);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  return `${weekdayName(date)}, ${formatShortDate(date, reference)}`;
}

export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
