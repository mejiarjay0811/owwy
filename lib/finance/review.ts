import { addMonthKey, daysInMonth, monthName } from "@/lib/dates";
import type { Budget, Category, ID, Minor, MonthKey, OwwyDataset, Transaction } from "@/types/models";
import { computeBudgetProgress } from "./budgets";
import { goalContribution } from "./goals";
import { categoryChanges, type CategoryChange } from "./insights";
import { percentChange, savingsRate, summarizeMonth, type PeriodSummary } from "./summary";

export type ReviewMood = "celebrating" | "happy" | "encouraging" | "concerned";

export interface MonthlyReview {
  month: MonthKey;
  label: string;
  current: PeriodSummary;
  previous: PeriodSummary;
  savingsRate: number;
  previousSavingsRate: number;
  spentChange: number | null;
  incomeChange: number | null;
  savedDiff: Minor;
  topCategories: (CategoryChange & { share: number })[];
  bestCategory: CategoryChange | null;
  highestIncrease: CategoryChange | null;
  budgets: { total: number; within: number; over: number; budgeted: Minor; spent: Minor };
  goals: { id: ID; name: string; emoji: string; contributed: Minor }[];
  biggestExpense: Transaction | null;
  noSpendDays: number;
  hasData: boolean;
  mood: ReviewMood;
  headline: string;
  message: string;
}

export function buildMonthlyReview(
  data: Pick<OwwyDataset, "transactions" | "accounts" | "goals" | "categories" | "budgets">,
  month: MonthKey,
  today: string,
  format: (minor: Minor) => string,
): MonthlyReview {
  const previousMonth = addMonthKey(month, -1);
  const current = summarizeMonth(data.transactions, data.accounts, data.goals, month);
  const previous = summarizeMonth(data.transactions, data.accounts, data.goals, previousMonth);
  const categoriesById = new Map<ID, Category>(data.categories.map((c) => [c.id, c]));
  const changes = categoryChanges(current, previous, categoriesById);

  const topCategories = changes
    .filter((c) => c.current > 0)
    .slice(0, 6)
    .map((c) => ({ ...c, share: current.spent > 0 ? (c.current / current.spent) * 100 : 0 }));

  const bestCategory =
    changes
      .filter((c) => c.previous > 0 && c.diff < 0)
      .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0] ?? null;
  const highestIncrease =
    changes
      .filter((c) => c.previous > 0 && c.diff > 0)
      .sort((a, b) => b.diff - a.diff)[0] ?? null;

  const budgetsForMonth: Budget[] = data.budgets.filter((b) => b.month === month && !b.paused);
  const progress = computeBudgetProgress(budgetsForMonth, data.categories, current.byCategory, month, today);
  const budgets = {
    total: progress.length,
    within: progress.filter((p) => p.spent <= p.budget.amount).length,
    over: progress.filter((p) => p.spent > p.budget.amount).length,
    budgeted: progress.reduce((t, p) => t + p.budget.amount, 0),
    spent: progress.reduce((t, p) => t + p.spent, 0),
  };

  const goals = data.goals
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      emoji: goal.emoji,
      contributed: data.transactions
        .filter((tx) => tx.date.startsWith(month))
        .reduce((t, tx) => t + goalContribution(goal, tx), 0),
    }))
    .filter((g) => g.contributed !== 0);

  const biggestExpense =
    data.transactions
      .filter((tx) => tx.type === "expense" && tx.date.startsWith(month))
      .sort((a, b) => b.amount - a.amount)[0] ?? null;

  const [y, m] = month.split("-").map(Number);
  const totalDays = today.startsWith(month) ? Number(today.slice(8, 10)) : daysInMonth(y, m);
  const noSpendDays = Math.max(0, totalDays - current.byDay.size);

  const rate = savingsRate(current);
  const previousRate = savingsRate(previous);
  const savedDiff = current.saved - previous.saved;
  const hasData = current.transactionCount > 0;

  let mood: ReviewMood = "encouraging";
  let headline = `Here's your ${monthName(month)}.`;
  let message = "Every month you track teaches Owwy a little more about your money.";

  if (!hasData) {
    mood = "encouraging";
    headline = `No activity recorded in ${monthName(month)}.`;
    message = "Add transactions and your review will fill itself in.";
  } else if (current.saved > 0 && savedDiff > 0 && previous.transactionCount > 0) {
    mood = "celebrating";
    headline = `You saved ${format(savedDiff)} more than last month.`;
    message = "That's real progress. Keep the momentum going next month.";
  } else if (previous.spent > 0 && current.spent < previous.spent) {
    mood = "happy";
    headline = `You spent ${format(previous.spent - current.spent)} less than last month.`;
    message = "Small choices added up. Nicely done.";
  } else if (budgets.over > 0) {
    mood = "concerned";
    headline = `${budgets.over} budget${budgets.over > 1 ? "s" : ""} went over this month.`;
    message = "Let's look at what pushed them over and adjust next month's plan together.";
  } else if (current.income > 0 && current.spent > current.income) {
    mood = "concerned";
    headline = "You spent more than you earned.";
    message = "Let's find one or two categories to trim next month.";
  } else if (current.saved > 0) {
    mood = "happy";
    headline = `You saved ${format(current.saved)} this month.`;
    message = "Paying yourself first is the habit that matters most.";
  }

  return {
    month,
    label: `${monthName(month)} Review`,
    current,
    previous,
    savingsRate: rate,
    previousSavingsRate: previousRate,
    spentChange: percentChange(current.spent, previous.spent),
    incomeChange: percentChange(current.income, previous.income),
    savedDiff,
    topCategories,
    bestCategory,
    highestIncrease,
    budgets,
    goals,
    biggestExpense,
    noSpendDays,
    hasData,
    mood,
    headline,
    message,
  };
}
