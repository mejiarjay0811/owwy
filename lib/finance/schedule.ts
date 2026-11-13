import { addDays, addMonths, daysInMonth, diffDays, makeDate, parseISODate } from "@/lib/dates";
import type { IncomeSchedule, ISODate, RecurringTransaction } from "@/types/models";

/**
 * Finds the next date income is expected strictly after `today`.
 * Recurring income rules (e.g. "Salary") are the most precise source;
 * otherwise the income schedule chosen during onboarding is used.
 */
export function nextIncomeDate(
  schedule: IncomeSchedule,
  recurring: readonly RecurringTransaction[],
  today: ISODate,
): ISODate {
  const fromRules = recurring
    .filter((r) => r.active && r.type === "income" && r.nextDate > today && (!r.endDate || r.nextDate <= r.endDate))
    .map((r) => r.nextDate)
    .sort()[0];

  const fromSchedule = nextScheduledPayday(schedule, today);
  if (fromRules && fromRules < fromSchedule) return fromRules;
  // Prefer rules if the schedule is "irregular" (month-end fallback).
  if (fromRules && schedule.frequency === "irregular") return fromRules;
  return fromSchedule;
}

export function nextScheduledPayday(schedule: IncomeSchedule, today: ISODate): ISODate {
  const { y, m } = parseISODate(today);

  switch (schedule.frequency) {
    case "monthly":
    case "semimonthly": {
      const days = (schedule.paydays.length ? schedule.paydays : [schedule.frequency === "monthly" ? 31 : 15])
        .slice(0, schedule.frequency === "monthly" ? 1 : 2)
        .sort((a, b) => a - b);
      // Look at this month and next month, pick the first payday after today.
      for (let offset = 0; offset < 3; offset++) {
        const base = addMonths(makeDate(y, m, 1), offset);
        const { y: by, m: bm } = parseISODate(base);
        for (const day of days) {
          const date = makeDate(by, bm, Math.min(day, daysInMonth(by, bm)));
          if (date > today) return date;
        }
      }
      return addDays(today, 30);
    }
    case "weekly":
    case "biweekly": {
      const step = schedule.frequency === "weekly" ? 7 : 14;
      const anchor = schedule.anchorDate ?? today;
      const diff = diffDays(anchor, today);
      if (diff < 0) return anchor;
      const periods = Math.floor(diff / step) + 1;
      return addDays(anchor, periods * step);
    }
    case "irregular":
    default: {
      // No fixed payday: plan until the first day of next month.
      return addMonths(makeDate(y, m, 1), 1);
    }
  }
}
