import { addDays, addMonthKey, formatShortDate, monthKey, monthName, monthStart, startOfWeek, weekdayName } from "@/lib/dates";
import type { ISODate, Minor, Transaction } from "@/types/models";

export type SpendingPeriod = "day" | "week" | "month";

export interface SpendingBucket {
  /** First date of the bucket. */
  start: ISODate;
  label: string;
  /** Longer label for screen readers and tooltips. */
  longLabel: string;
  amount: Minor;
  current: boolean;
}

export interface SpendingSeries {
  period: SpendingPeriod;
  buckets: SpendingBucket[];
  /** Spending in the current bucket (today, this week or this month). */
  current: Minor;
  /** Average of the earlier buckets, 0 when there's no history. */
  average: Minor;
  /** Current bucket vs. the one before it, as a percent; null when there's no baseline. */
  change: number | null;
}

const COUNTS: Record<SpendingPeriod, number> = { day: 7, week: 6, month: 6 };

/**
 * Spending grouped into the last few days, weeks or months — ending with the current one.
 * Transfers and money lent to or collected from people are not spending.
 */
export function spendingSeries(
  transactions: readonly Transaction[],
  today: ISODate,
  period: SpendingPeriod,
  weekStartsOn: 0 | 1 = 1,
): SpendingSeries {
  const count = COUNTS[period];
  const keyOf = (date: ISODate): ISODate =>
    period === "day" ? date : period === "week" ? startOfWeek(date, weekStartsOn) : monthStart(monthKey(date));

  const currentKey = keyOf(today);
  const starts: ISODate[] = [];
  for (let i = count - 1; i >= 0; i--) {
    starts.push(
      period === "day" ? addDays(today, -i) : period === "week" ? addDays(currentKey, -7 * i) : monthStart(addMonthKey(monthKey(today), -i)),
    );
  }

  const totals = new Map<ISODate, Minor>(starts.map((s) => [s, 0]));
  const earliest = starts[0];
  for (const tx of transactions) {
    if (tx.type !== "expense" || tx.receivableId || tx.date < earliest || tx.date > today) continue;
    const key = keyOf(tx.date);
    const value = totals.get(key);
    if (value !== undefined) totals.set(key, value + tx.amount);
  }

  const buckets: SpendingBucket[] = starts.map((start) => ({
    start,
    label: period === "day" ? weekdayName(start, true).slice(0, 2) : period === "week" ? formatShortDate(start) : monthName(monthKey(start), true),
    longLabel:
      period === "day"
        ? `${weekdayName(start)}, ${formatShortDate(start)}`
        : period === "week"
          ? `Week of ${formatShortDate(start)}`
          : monthName(monthKey(start)),
    amount: totals.get(start) ?? 0,
    current: start === currentKey,
  }));

  const current = buckets[buckets.length - 1]?.amount ?? 0;
  const earlier = buckets.slice(0, -1);
  const withSpend = earlier.filter((b) => b.amount > 0);
  const average = withSpend.length ? Math.round(earlier.reduce((t, b) => t + b.amount, 0) / earlier.length) : 0;
  const previous = earlier[earlier.length - 1]?.amount ?? 0;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;

  return { period, buckets, current, average, change };
}
