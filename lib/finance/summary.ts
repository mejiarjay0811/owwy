import { isBetween, monthEnd, monthStart } from "@/lib/dates";
import type { Account, ID, ISODate, Minor, MonthKey, SavingsGoal, Transaction } from "@/types/models";
import { isSavingsAccount } from "./balances";

export interface PeriodSummary {
  from: ISODate;
  to: ISODate;
  income: Minor;
  spent: Minor;
  /** Net money moved into savings (goal contributions, transfers to savings accounts). */
  saved: Minor;
  /** income − spent */
  net: Minor;
  /** Spending per expense category. */
  byCategory: Map<ID, Minor>;
  /** Income per income category. */
  incomeByCategory: Map<ID, Minor>;
  /** Spending per day. */
  byDay: Map<ISODate, Minor>;
  expenseCount: number;
  transactionCount: number;
}

/**
 * Classifies a transfer's effect on savings:
 * +amount when money moves into savings, −amount when it comes back out,
 * 0 for moves that stay on the same side (e.g. wallet → bank).
 */
export function savingsDelta(
  tx: Transaction,
  accountsById: Map<ID, Account>,
  goalsById: Map<ID, SavingsGoal>,
): Minor {
  if (tx.type !== "transfer" || !tx.toAccountId) return 0;
  const from = accountsById.get(tx.accountId);
  const to = accountsById.get(tx.toAccountId);
  const goal = tx.goalId ? goalsById.get(tx.goalId) : undefined;

  const intoSavings = (to ? isSavingsAccount(to) : false) || (goal !== undefined && goal.accountId === tx.toAccountId);
  const outOfSavings =
    (from ? isSavingsAccount(from) : false) || (goal !== undefined && goal.accountId === tx.accountId);

  if (intoSavings && !outOfSavings) return tx.amount;
  if (outOfSavings && !intoSavings) return -tx.amount;
  return 0;
}

export function summarizePeriod(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  goals: readonly SavingsGoal[],
  from: ISODate,
  to: ISODate,
): PeriodSummary {
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const goalsById = new Map(goals.map((g) => [g.id, g]));
  const summary: PeriodSummary = {
    from,
    to,
    income: 0,
    spent: 0,
    saved: 0,
    net: 0,
    byCategory: new Map(),
    incomeByCategory: new Map(),
    byDay: new Map(),
    expenseCount: 0,
    transactionCount: 0,
  };

  for (const tx of transactions) {
    if (!isBetween(tx.date, from, to)) continue;
    summary.transactionCount++;
    // Lending money out or collecting it back isn't spending or earning.
    if (tx.receivableId) continue;
    if (tx.type === "expense") {
      summary.spent += tx.amount;
      summary.expenseCount++;
      const cat = tx.categoryId ?? "uncategorized";
      summary.byCategory.set(cat, (summary.byCategory.get(cat) ?? 0) + tx.amount);
      summary.byDay.set(tx.date, (summary.byDay.get(tx.date) ?? 0) + tx.amount);
    } else if (tx.type === "income") {
      summary.income += tx.amount;
      const cat = tx.categoryId ?? "uncategorized";
      summary.incomeByCategory.set(cat, (summary.incomeByCategory.get(cat) ?? 0) + tx.amount);
    } else {
      summary.saved += savingsDelta(tx, accountsById, goalsById);
    }
  }
  summary.net = summary.income - summary.spent;
  return summary;
}

export function summarizeMonth(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  goals: readonly SavingsGoal[],
  month: MonthKey,
): PeriodSummary {
  return summarizePeriod(transactions, accounts, goals, monthStart(month), monthEnd(month));
}

/** Savings as a share of income, 0–100 (can be negative if savings were withdrawn). */
export function savingsRate(summary: Pick<PeriodSummary, "income" | "saved">): number {
  if (summary.income <= 0) return 0;
  return (summary.saved / summary.income) * 100;
}

/** Percent change from `previous` to `current`; null when there is no baseline. */
export function percentChange(current: Minor, previous: Minor): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
