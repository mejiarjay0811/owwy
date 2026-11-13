import { addMonthKey, addMonths, diffDays, monthKey } from "@/lib/dates";
import type { ISODate, Minor, SavingsGoal, Transaction } from "@/types/models";

export type GoalPace = "complete" | "onTrack" | "behind" | "noDeadline" | "overdue";

export interface GoalProgress {
  goal: SavingsGoal;
  saved: Minor;
  remaining: Minor;
  percent: number;
  /** Whole months left until the target date (at least 1 when a date is set and not passed). */
  monthsLeft: number | null;
  /** Suggested monthly contribution to hit the target date. */
  requiredMonthly: Minor;
  /** Contributions this month. */
  contributedThisMonth: Minor;
  /** Average monthly contribution across the last 3 months. */
  averageMonthly: Minor;
  /** Estimated completion date at the recent pace. */
  projectedDate: ISODate | null;
  pace: GoalPace;
}

/** Amount contributed to the goal by a single transaction (negative for withdrawals). */
export function goalContribution(goal: SavingsGoal, tx: Transaction): Minor {
  if (tx.goalId !== goal.id || tx.type !== "transfer") return 0;
  if (tx.toAccountId === goal.accountId && tx.accountId !== goal.accountId) return tx.toAmount ?? tx.amount;
  if (tx.accountId === goal.accountId && tx.toAccountId !== goal.accountId) return -tx.amount;
  return 0;
}

export function goalSaved(goal: SavingsGoal, transactions: readonly Transaction[]): Minor {
  let saved = goal.startingAmount;
  for (const tx of transactions) saved += goalContribution(goal, tx);
  return saved;
}

/** Months between today and the target date, rounded up, minimum 1. */
export function monthsUntil(today: ISODate, target: ISODate): number {
  const days = diffDays(today, target);
  if (days <= 0) return 0;
  return Math.max(1, Math.ceil(days / 30.44));
}

export function computeGoalProgress(goal: SavingsGoal, transactions: readonly Transaction[], today: ISODate): GoalProgress {
  const saved = goalSaved(goal, transactions);
  const remaining = Math.max(0, goal.targetAmount - saved);
  const percent = goal.targetAmount > 0 ? Math.min(100, (saved / goal.targetAmount) * 100) : 0;
  const currentMonth = monthKey(today);

  let contributedThisMonth = 0;
  let lastThreeMonths = 0;
  const threeMonthsAgo = addMonthKey(currentMonth, -2);
  for (const tx of transactions) {
    const amount = goalContribution(goal, tx);
    if (amount === 0) continue;
    const m = monthKey(tx.date);
    if (m === currentMonth) contributedThisMonth += amount;
    if (m >= threeMonthsAgo && m <= currentMonth) lastThreeMonths += amount;
  }
  const averageMonthly = Math.max(0, Math.round(lastThreeMonths / 3));

  const monthsLeft = goal.targetDate ? monthsUntil(today, goal.targetDate) : null;
  let requiredMonthly = 0;
  if (remaining > 0) {
    if (monthsLeft !== null && monthsLeft > 0) requiredMonthly = Math.ceil(remaining / monthsLeft);
    else if (monthsLeft === 0) requiredMonthly = remaining;
  }

  let projectedDate: ISODate | null = null;
  if (remaining === 0) projectedDate = today;
  else if (averageMonthly > 0) projectedDate = addMonths(today, Math.ceil(remaining / averageMonthly));

  let pace: GoalPace;
  if (remaining === 0) pace = "complete";
  else if (!goal.targetDate) pace = "noDeadline";
  else if (monthsLeft === 0) pace = "overdue";
  else if (contributedThisMonth >= requiredMonthly || (projectedDate !== null && projectedDate <= goal.targetDate)) pace = "onTrack";
  else pace = "behind";

  return {
    goal,
    saved,
    remaining,
    percent,
    monthsLeft,
    requiredMonthly,
    contributedThisMonth,
    averageMonthly,
    projectedDate,
    pace,
  };
}

/** Total suggested monthly savings across active goals. */
export function totalRequiredMonthly(progress: readonly GoalProgress[]): Minor {
  return progress
    .filter((p) => !p.goal.archived && p.remaining > 0)
    .reduce((total, p) => total + p.requiredMonthly, 0);
}
