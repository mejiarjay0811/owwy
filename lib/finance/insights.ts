import type { Category, ID, Minor } from "@/types/models";
import type { BudgetProgress } from "./budgets";
import type { PeriodSummary } from "./summary";
import { percentChange, savingsRate } from "./summary";

export type InsightTone = "positive" | "neutral" | "attention";

export interface Insight {
  id: string;
  tone: InsightTone;
  emoji: string;
  title: string;
  detail: string;
  /** Lower sorts first. */
  priority: number;
}

export interface CategoryChange {
  categoryId: ID;
  category: Category | undefined;
  current: Minor;
  previous: Minor;
  diff: Minor;
  change: number | null;
}

export function categoryChanges(
  current: PeriodSummary,
  previous: PeriodSummary,
  categoriesById: Map<ID, Category>,
): CategoryChange[] {
  const ids = new Set([...current.byCategory.keys(), ...previous.byCategory.keys()]);
  return [...ids]
    .map((id) => {
      const c = current.byCategory.get(id) ?? 0;
      const p = previous.byCategory.get(id) ?? 0;
      return { categoryId: id, category: categoriesById.get(id), current: c, previous: p, diff: c - p, change: percentChange(c, p) };
    })
    .sort((a, b) => b.current - a.current);
}

export interface InsightInput {
  /** Month-to-date summary (or full month when reviewing the past). */
  current: PeriodSummary;
  /** Same span of the previous month, for fair comparisons. */
  previousSameSpan: PeriodSummary;
  /** Whole previous month. */
  previousFull: PeriodSummary;
  categoriesById: Map<ID, Category>;
  budgets: readonly BudgetProgress[];
  /** 0–100 */
  monthElapsed: number;
  daysElapsed: number;
  format: (minor: Minor) => string;
}

/**
 * Plain-language, deterministic observations. Each answers a real question:
 * Am I spending more? Where? Am I saving? Am I on budget?
 */
export function generateInsights(input: InsightInput): Insight[] {
  const { current, previousSameSpan, previousFull, categoriesById, format } = input;
  const insights: Insight[] = [];
  const changes = categoryChanges(current, previousSameSpan, categoriesById);
  const meaningful = (diff: Minor, base: Minor) => Math.abs(diff) >= Math.max(base * 0.1, current.spent * 0.03, 1);

  // Overall pace vs last month.
  if (previousSameSpan.spent > 0 && current.spent > 0) {
    const diff = current.spent - previousSameSpan.spent;
    if (meaningful(diff, previousSameSpan.spent)) {
      insights.push(
        diff < 0
          ? {
              id: "pace-less",
              tone: "positive",
              emoji: "🌿",
              title: `${format(-diff)} less than last month`,
              detail: `You're spending less than you had by this point last month. Nice work.`,
              priority: 1,
            }
          : {
              id: "pace-more",
              tone: "attention",
              emoji: "📈",
              title: `${format(diff)} more than last month`,
              detail: `Compared with the same days last month, spending is up ${Math.round((diff / previousSameSpan.spent) * 100)}%.`,
              priority: 2,
            },
      );
    }
  }

  // Over-budget categories, explained.
  for (const b of input.budgets) {
    if (b.budget.paused || b.status !== "over" || !b.category) continue;
    insights.push({
      id: `budget-over-${b.budget.id}`,
      tone: "attention",
      emoji: b.category.emoji,
      title: `${b.category.name} is ${Math.round(b.percent)}% of budget`,
      detail: `You're ${format(-b.remaining)} over. That's ${format(-b.remaining)} less available for other categories this month.`,
      priority: 0,
    });
  }

  // Biggest category increase.
  const increase = changes.filter((c) => c.diff > 0 && c.previous > 0 && meaningful(c.diff, c.previous)).sort((a, b) => b.diff - a.diff)[0];
  if (increase?.category) {
    insights.push({
      id: `cat-up-${increase.categoryId}`,
      tone: "attention",
      emoji: increase.category.emoji,
      title: `${increase.category.name} up ${Math.round(increase.change ?? 0)}%`,
      detail: `You spent ${format(increase.diff)} more on ${increase.category.name.toLowerCase()} than at this point last month.`,
      priority: 3,
    });
  }

  // Biggest category decrease.
  const decrease = changes.filter((c) => c.diff < 0 && meaningful(c.diff, c.previous)).sort((a, b) => a.diff - b.diff)[0];
  if (decrease?.category) {
    insights.push({
      id: `cat-down-${decrease.categoryId}`,
      tone: "positive",
      emoji: decrease.category.emoji,
      title: `${decrease.category.name} down ${Math.abs(Math.round(decrease.change ?? 100))}%`,
      detail: `${format(-decrease.diff)} less on ${decrease.category.name.toLowerCase()} than last month so far.`,
      priority: 4,
    });
  }

  // Highest discretionary category.
  const discretionary = changes.find((c) => c.category?.discretionary && c.current > 0);
  if (discretionary?.category && current.spent > 0) {
    insights.push({
      id: "top-discretionary",
      tone: "neutral",
      emoji: discretionary.category.emoji,
      title: `${discretionary.category.name} is your top flexible spend`,
      detail: `${format(discretionary.current)} so far — ${Math.round((discretionary.current / current.spent) * 100)}% of everything you've spent this month.`,
      priority: 5,
    });
  }

  // Savings rate.
  if (current.income > 0) {
    const rate = savingsRate(current);
    if (current.saved > 0) {
      const prevSaved = previousFull.saved;
      insights.push({
        id: "savings-rate",
        tone: "positive",
        emoji: "🐷",
        title: `Saved ${format(current.saved)} · ${rate.toFixed(1)}% of income`,
        detail:
          prevSaved > 0 && current.saved > prevSaved
            ? `That's ${format(current.saved - prevSaved)} more than all of last month.`
            : rate >= 20
              ? "That's a strong savings rate. Keep it going."
              : "Every bit set aside makes next month easier.",
        priority: 6,
      });
    } else if (input.monthElapsed > 40) {
      insights.push({
        id: "no-savings",
        tone: "attention",
        emoji: "🪺",
        title: "Nothing saved yet this month",
        detail: "Even a small transfer to savings right after payday adds up.",
        priority: 7,
      });
    }
  }

  // No-spend days.
  const noSpendDays = input.daysElapsed - current.byDay.size;
  if (input.daysElapsed >= 7 && noSpendDays >= 3) {
    insights.push({
      id: "no-spend-days",
      tone: "positive",
      emoji: "✨",
      title: `${noSpendDays} no-spend days`,
      detail: "Days without any spending this month. They make a real difference.",
      priority: 8,
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
}
