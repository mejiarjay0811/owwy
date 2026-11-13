import { diffDays } from "@/lib/dates";
import type { ISODate, Minor } from "@/types/models";
import type { BillOccurrence } from "./bills";
import type { BudgetProgress } from "./budgets";
import type { GoalProgress } from "./goals";
import type { SafeToSpendResult } from "./safe-to-spend";

export type OwwyMood = "happy" | "thinking" | "celebrating" | "concerned" | "sleeping" | "encouraging" | "neutral";

export interface OwwyMessage {
  mood: OwwyMood;
  text: string;
  /** Optional deep link for the message's call to action. */
  href?: string;
}

export interface OwwyVoiceInput {
  today: ISODate;
  hasAccounts: boolean;
  transactionCount: number;
  spentToday: Minor;
  monthToDateSpent: Minor;
  previousMonthToDateSpent: Minor;
  safeToSpend: SafeToSpendResult;
  budgets: readonly BudgetProgress[];
  goals: readonly GoalProgress[];
  upcomingBills: readonly BillOccurrence[];
  format: (minor: Minor) => string;
}

/**
 * Picks one short, contextual line for the dashboard.
 * Order matters: urgent and helpful beats cheerful.
 */
export function pickOwwyMessage(input: OwwyVoiceInput): OwwyMessage {
  const { safeToSpend: sts, format } = input;

  if (!input.hasAccounts) {
    return { mood: "encouraging", text: "Hi! I'm Owwy. Add your first account and let's see where your money goes.", href: "/accounts" };
  }
  if (input.transactionCount === 0) {
    return { mood: "sleeping", text: "Your wallet is quiet today. Add an expense and I'll start helping." };
  }
  if (sts.status === "atRisk") {
    return { mood: "concerned", text: "Heads up: upcoming bills need more than what's in your spending accounts.", href: "/safe-to-spend" };
  }

  const overdue = input.upcomingBills.find((o) => o.date < input.today);
  if (overdue) {
    return { mood: "concerned", text: `${overdue.bill.name} is overdue. Mark it paid once it's settled.`, href: "/bills" };
  }

  const over = input.budgets.find((b) => !b.budget.paused && b.status === "over" && b.category);
  if (over?.category) {
    return { mood: "concerned", text: `Hey, let's take another look at your ${over.category.name.toLowerCase()} budget.`, href: "/budgets" };
  }

  const dueSoon = input.upcomingBills.find((o) => diffDays(input.today, o.date) <= 1);
  if (dueSoon) {
    const when = dueSoon.date === input.today ? "today" : "tomorrow";
    return { mood: "thinking", text: `${dueSoon.bill.name} (${format(dueSoon.amount)}) is due ${when}.`, href: "/bills" };
  }

  const nearlyDone = input.goals.find((g) => !g.goal.archived && g.percent >= 75 && g.percent < 100);
  if (nearlyDone) {
    return { mood: "celebrating", text: `You're getting close to your ${nearlyDone.goal.name} goal — ${Math.round(nearlyDone.percent)}% there!`, href: "/goals" };
  }

  if (sts.status === "short") {
    return { mood: "thinking", text: "Money's tight until payday. Let's keep spending to the essentials.", href: "/safe-to-spend" };
  }

  if (input.previousMonthToDateSpent > 0 && input.monthToDateSpent < input.previousMonthToDateSpent * 0.95) {
    return { mood: "happy", text: "Nice work! You're spending less than last month." };
  }

  const growing = input.goals.find((g) => !g.goal.archived && g.contributedThisMonth > 0 && g.percent < 100);
  if (growing) {
    return { mood: "encouraging", text: `You're getting closer to your ${growing.goal.name} goal!`, href: "/goals" };
  }

  if (sts.status === "tight") {
    return { mood: "thinking", text: `About ${format(sts.perDay)} a day keeps you on track until payday.` };
  }

  if (input.spentToday === 0) {
    return { mood: "happy", text: "No spending yet today. You've got this." };
  }
  return { mood: "happy", text: "You're doing great this month." };
}
