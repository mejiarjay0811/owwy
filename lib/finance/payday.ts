import { diffDays } from "@/lib/dates";
import type { IncomeSchedule, ISODate, Minor, RecurringTransaction, Transaction } from "@/types/models";
import { nextIncomeDate } from "./schedule";

export interface PaydayInfo {
  date: ISODate;
  daysLeft: number;
  /** Expected amount, when Owwy can tell (from an automation or your last pay). */
  expectedAmount: Minor | null;
  /** Where the expected amount came from. */
  basis: "automation" | "last-payday" | null;
  /** Roughly how many days a pay cycle lasts, for progress rings. */
  cycleDays: number;
}

const CYCLE_DAYS: Record<IncomeSchedule["frequency"], number> = { weekly: 7, biweekly: 14, semimonthly: 15, monthly: 30, irregular: 30 };

/** How long until the next payday, and roughly how much is coming. */
export function computePayday(schedule: IncomeSchedule, recurring: readonly RecurringTransaction[], transactions: readonly Transaction[], today: ISODate): PaydayInfo {
  const date = nextIncomeDate(schedule, recurring, today);
  const daysLeft = Math.max(0, diffDays(today, date));
  const cycleDays = Math.max(CYCLE_DAYS[schedule.frequency], daysLeft);
  const scheduled = recurring.filter((r) => r.active && r.type === "income" && r.nextDate === date).reduce((t, r) => t + r.amount, 0);
  if (scheduled > 0) return { date, daysLeft, expectedAmount: scheduled, basis: "automation", cycleDays };

  // Otherwise use the most recent salary-like income.
  const lastPay = transactions
    .filter((t) => t.type === "income" && !t.receivableId && (t.categoryId === "cat_salary" || /salary|payroll|sweldo|pay/i.test(t.note)))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    date,
    daysLeft,
    expectedAmount: lastPay?.amount ?? null,
    basis: lastPay ? "last-payday" : null,
    cycleDays,
  };
}
