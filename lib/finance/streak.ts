import { addDays, dayOfWeek, startOfWeek } from "@/lib/dates";
import { INTEREST_CATEGORY_ID } from "@/lib/defaults/categories";
import type { ISODate, Transaction } from "@/types/models";

export interface LoggingStreak {
  /** Days in a row up to today (yesterday still counts until midnight). */
  current: number;
  longest: number;
  /** Days with at least one entry, ever. */
  daysLogged: number;
  lastLogged: ISODate | null;
  /** True when today has no entry yet but the streak is still alive. */
  atRisk: boolean;
}

export interface HeatmapDay {
  date: ISODate;
  count: number;
  /** 0–4, for how dark the square is. */
  level: number;
  future: boolean;
}

/**
 * Days you actually logged something. Automations and posted interest log
 * themselves, so they don't count — a streak should mean you showed up.
 */
export function loggedDays(transactions: readonly Transaction[]): Map<ISODate, number> {
  const days = new Map<ISODate, number>();
  for (const tx of transactions) {
    if (tx.recurringId || tx.categoryId === INTEREST_CATEGORY_ID) continue;
    days.set(tx.date, (days.get(tx.date) ?? 0) + 1);
  }
  return days;
}

export function computeStreak(days: Map<ISODate, number>, today: ISODate): LoggingStreak {
  const dates = [...days.keys()].filter((date) => date <= today).sort();
  if (!dates.length) return { current: 0, longest: 0, daysLogged: 0, lastLogged: null, atRisk: false };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = addDays(dates[i - 1], 1) === dates[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // Count back from today, allowing yesterday to hold the streak open.
  const yesterday = addDays(today, -1);
  const last = dates[dates.length - 1];
  let current = 0;
  if (last === today || last === yesterday) {
    let cursor = last;
    while (days.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest, daysLogged: dates.length, lastLogged: last, atRisk: current > 0 && last !== today };
}

/**
 * Weeks of squares ending with the week containing `today`, oldest first.
 * Each week starts on the day the user's calendar starts.
 */
export function heatmapWeeks(days: Map<ISODate, number>, today: ISODate, weekCount = 26, weekStartsOn: 0 | 1 = 1): HeatmapDay[][] {
  const thisWeek = startOfWeek(today, weekStartsOn);
  const first = addDays(thisWeek, -7 * (weekCount - 1));
  const weeks: HeatmapDay[][] = [];

  for (let w = 0; w < weekCount; w++) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      const count = days.get(date) ?? 0;
      week.push({ date, count, level: intensity(count), future: date > today });
    }
    weeks.push(week);
  }
  return weeks;
}

function intensity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** Row labels for the heatmap, in the same order as each week's squares. */
export function weekdayInitials(weekStartsOn: 0 | 1 = 1): string[] {
  const names = ["S", "M", "T", "W", "T", "F", "S"];
  return [...names.slice(weekStartsOn), ...names.slice(0, weekStartsOn)];
}

/** A short line about the streak, in Owwy's voice. */
export function streakLine(streak: LoggingStreak): string {
  const days = `${streak.current} ${streak.current === 1 ? "day" : "days"}`;
  if (streak.current === 0) return streak.daysLogged ? "Log something today to start a new run." : "Log your first expense to start a streak.";
  if (streak.atRisk) return `${days} — log something today to keep it.`;
  if (streak.current === streak.longest && streak.current > 2) return `${days} in a row — your best run yet.`;
  return `${days} in a row.`;
}

export { dayOfWeek };
