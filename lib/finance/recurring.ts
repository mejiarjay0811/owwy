import { nextOccurrence, occurrencesBetween } from "@/lib/dates";
import type { ISODate, RecurringTransaction } from "@/types/models";

export interface RecurringCatchUp {
  /** Occurrence dates that should be posted now (oldest first). */
  dates: ISODate[];
  /** The rule's next unposted date after posting. */
  nextDate: ISODate;
  /** False once the rule passed its end date. */
  active: boolean;
}

/** Maximum occurrences posted in one catch-up, so a long absence can't flood the ledger. */
export const MAX_CATCH_UP = 120;

/**
 * Works out which occurrences of a recurring rule are due as of `today`.
 * Deterministic: posting the returned dates and saving `nextDate` makes the
 * operation idempotent across app launches.
 */
export function planRecurringCatchUp(rule: RecurringTransaction, today: ISODate): RecurringCatchUp {
  if (!rule.active) return { dates: [], nextDate: rule.nextDate, active: false };

  const limit = rule.endDate && rule.endDate < today ? rule.endDate : today;
  const dates = rule.nextDate <= limit
    ? occurrencesBetween(rule.nextDate, rule.frequency, rule.nextDate, limit, rule.anchorDay, MAX_CATCH_UP)
    : [];

  const last = dates.at(-1);
  const nextDate = last ? (nextOccurrence(last, rule.frequency, rule.anchorDay) ?? last) : rule.nextDate;
  const active = !rule.endDate || nextDate <= rule.endDate;
  return { dates, nextDate, active };
}

/** Automations set to "ask first" whose date has arrived. */
export function pendingAutomations(rules: readonly RecurringTransaction[], today: ISODate): RecurringTransaction[] {
  return rules
    .filter((r) => r.active && r.mode === "confirm" && r.nextDate <= today && (!r.endDate || r.nextDate <= r.endDate))
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/** Future occurrences in a window, for calendar and Safe-to-Spend projections. */
export function upcomingRecurring(
  rules: readonly RecurringTransaction[],
  from: ISODate,
  to: ISODate,
): { rule: RecurringTransaction; date: ISODate }[] {
  const result: { rule: RecurringTransaction; date: ISODate }[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
    for (const date of occurrencesBetween(rule.nextDate, rule.frequency, from, end, rule.anchorDay)) {
      result.push({ rule, date });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
