import { daysInMonth, monthEnd, monthKey, monthStart } from "@/lib/dates";
import type { ISODate, Minor, Transaction } from "@/types/models";
import type { MoneyMove } from "./upcoming";

export interface MonthForecast {
  /** Income logged so far this month. */
  actualIncome: Minor;
  /** Income still scheduled before month end (automations, money owed to you). */
  expectedIncome: Minor;
  /** Spending logged so far this month. */
  actualSpent: Minor;
  /** Bills, card payments and automations still due this month (including overdue ones). */
  scheduledSpend: Minor;
  /** Everyday spending for the rest of the month, at this month's daily pace. */
  everydaySpend: Minor;
  /** Average everyday spending per day so far. */
  everydayPerDay: Minor;
  daysLeft: number;
  /** Where the month should land: (income + expected) − (spent + scheduled + everyday). */
  projectedNet: Minor;
}

/**
 * A plain, explainable month-end forecast: what's happened, what's scheduled,
 * and everyday spending continuing at the current pace.
 */
export function forecastMonth(input: { today: ISODate; transactions: readonly Transaction[]; upcoming: { income: readonly MoneyMove[]; expenses: readonly MoneyMove[] } }): MonthForecast {
  const { today } = input;
  const month = monthKey(today);
  const start = monthStart(month);
  const end = monthEnd(month);
  const [y, m] = month.split("-").map(Number);
  const dayNumber = Number(today.slice(8, 10));
  const daysLeft = daysInMonth(y, m) - dayNumber;

  let actualIncome = 0;
  let actualSpent = 0;
  let everydaySoFar = 0;
  for (const t of input.transactions) {
    if (t.date < start || t.date > today || t.receivableId) continue;
    if (t.type === "income") actualIncome += t.amount;
    else if (t.type === "expense") {
      actualSpent += t.amount;
      if (!t.billId && !t.recurringId && !t.debtId) everydaySoFar += t.amount;
    }
  }

  // Everything still scheduled (handled items have already moved on to their next date); overdue ones are still owed.
  const pending = (moves: readonly MoneyMove[]) => moves.filter((mv) => mv.date <= end).reduce((s, mv) => s + mv.amount, 0);
  const expectedIncome = pending(input.upcoming.income);
  const scheduledSpend = pending(input.upcoming.expenses);
  const everydayPerDay = dayNumber > 0 ? Math.round(everydaySoFar / dayNumber) : 0;
  const everydaySpend = everydayPerDay * daysLeft;

  return {
    actualIncome,
    expectedIncome,
    actualSpent,
    scheduledSpend,
    everydaySpend,
    everydayPerDay,
    daysLeft,
    projectedNet: actualIncome + expectedIncome - (actualSpent + scheduledSpend + everydaySpend),
  };
}
