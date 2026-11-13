import type { Budget, Category, ID, Minor, MonthKey } from "@/types/models";

export type BudgetStatus = "calm" | "watch" | "near" | "over";

export interface BudgetProgress {
  budget: Budget;
  category: Category | undefined;
  spent: Minor;
  remaining: Minor;
  /** 0–∞, 100 = exactly on budget. */
  percent: number;
  /** Share of the month that has elapsed, 0–100. Used to judge pace. */
  monthElapsed: number;
  status: BudgetStatus;
  /** Projected month-end spending at the current pace. */
  projected: Minor;
}

/**
 * Status considers both how much is used and how far into the month we are,
 * so 60% used on day 5 is flagged while 90% used on day 29 is fine.
 */
export function budgetStatus(percent: number, monthElapsed: number): BudgetStatus {
  if (percent > 100) return "over";
  if (percent >= 90) return "near";
  if (percent >= 50 && percent > monthElapsed + 15) return "watch";
  return "calm";
}

export function computeBudgetProgress(
  budgets: readonly Budget[],
  categories: readonly Category[],
  spendingByCategory: Map<ID, Minor>,
  month: MonthKey,
  today: string,
): BudgetProgress[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const elapsed = monthElapsedPercent(month, today);

  return budgets
    .filter((b) => b.month === month)
    .map((budget) => {
      const spent = spendingByCategory.get(budget.categoryId) ?? 0;
      const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : spent > 0 ? 999 : 0;
      const projected = elapsed > 0 && elapsed < 100 ? Math.round((spent / elapsed) * 100) : spent;
      return {
        budget,
        category: categoriesById.get(budget.categoryId),
        spent,
        remaining: budget.amount - spent,
        percent,
        monthElapsed: elapsed,
        status: budget.paused ? "calm" : budgetStatus(percent, elapsed),
        projected,
      } satisfies BudgetProgress;
    })
    .sort((a, b) => Number(a.budget.paused) - Number(b.budget.paused) || b.percent - a.percent);
}

/** How much of `month` has passed as of `today` (0 before, 100 after). */
export function monthElapsedPercent(month: MonthKey, today: string): number {
  const current = today.slice(0, 7);
  if (current < month) return 0;
  if (current > month) return 100;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Number(today.slice(8, 10));
  return (day / days) * 100;
}

export interface BudgetTotals {
  budgeted: Minor;
  spent: Minor;
  remaining: Minor;
  overCount: number;
  activeCount: number;
}

export function computeBudgetTotals(progress: readonly BudgetProgress[]): BudgetTotals {
  const totals: BudgetTotals = { budgeted: 0, spent: 0, remaining: 0, overCount: 0, activeCount: 0 };
  for (const p of progress) {
    if (p.budget.paused) continue;
    totals.activeCount++;
    totals.budgeted += p.budget.amount;
    totals.spent += p.spent;
    if (p.status === "over") totals.overCount++;
  }
  totals.remaining = totals.budgeted - totals.spent;
  return totals;
}

/** Budgets to create when copying `from` into `to`, skipping categories already budgeted. */
export function planBudgetCopy(budgets: readonly Budget[], from: MonthKey, to: MonthKey): Budget[] {
  const existing = new Set(budgets.filter((b) => b.month === to).map((b) => b.categoryId));
  return budgets.filter((b) => b.month === from && !existing.has(b.categoryId));
}
