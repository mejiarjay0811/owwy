import type { BudgetProgress, BudgetStatus } from "./budgets";
import type { GoalPace } from "./goals";

/** Shared, plain-language labels so every screen explains numbers the same way. */

export function budgetTone(status: BudgetStatus): "brand" | "warning" | "negative" {
  if (status === "over") return "negative";
  if (status === "near" || status === "watch") return "warning";
  return "brand";
}

export function budgetStatusText(b: BudgetProgress): string {
  const pct = Math.round(b.percent);
  if (b.budget.paused) return "Paused";
  if (b.status === "over") return `${pct}% used — over budget`;
  if (b.status === "near") return `${pct}% used — almost at the limit`;
  if (b.status === "watch") return `${pct}% used, ahead of the month`;
  return b.monthElapsed >= 100 ? `${pct}% used` : `${pct}% used · on pace`;
}

export const GOAL_PACE_LABEL: Record<GoalPace, string> = {
  complete: "Goal reached",
  onTrack: "On track",
  behind: "Needs a boost",
  noDeadline: "No deadline",
  overdue: "Past target date",
};
