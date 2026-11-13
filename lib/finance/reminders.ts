import { addMonthKey, monthName, relativeDatePhrase } from "@/lib/dates";
import type { ISODate, MonthlySnapshot, RecurringTransaction } from "@/types/models";
import type { BudgetProgress } from "./budgets";
import type { ReceivableProgress } from "./receivables";
import { pendingAutomations } from "./recurring";
import type { MoneyMove } from "./upcoming";

export type ReminderKind = "due" | "overdue" | "confirm" | "budget" | "review" | "collect" | "payday";

export interface Reminder {
  id: string;
  kind: ReminderKind;
  emoji: string;
  title: string;
  detail: string;
  href: string;
  /** Higher is more urgent. */
  priority: number;
  /** Money involved, in the main currency, when there is one. */
  amount?: number;
}

export interface ReminderInput {
  today: ISODate;
  month: string;
  expenses: readonly MoneyMove[];
  recurring: readonly RecurringTransaction[];
  budgets: readonly BudgetProgress[];
  receivables: readonly ReceivableProgress[];
  snapshots: readonly Pick<MonthlySnapshot, "id" | "seen">[];
  paydayDaysLeft: number;
  /** Days ahead that count as "due soon". */
  soonDays?: number;
}

/** Everything worth a gentle nudge right now, most urgent first. */
export function computeReminders(input: ReminderInput): Reminder[] {
  const { today } = input;
  const soon = input.soonDays ?? 3;
  const reminders: Reminder[] = [];
  const pending = pendingAutomations(input.recurring, today);
  const pendingIds = new Set(pending.map((r) => r.id));

  for (const move of input.expenses) {
    // Automations waiting for confirmation get their own reminder below.
    if (move.source === "automation" && (move.overdue || pendingIds.has(move.refId))) continue;
    if (move.overdue) {
      reminders.push({ id: move.id, kind: "overdue", emoji: move.emoji, title: `${move.label} is overdue`, detail: `Was due ${relativeDatePhrase(move.date, today)}`, href: hrefFor(move), priority: 100, amount: move.amount });
    } else if (move.daysLeft <= soon) {
      reminders.push({
        id: move.id,
        kind: "due",
        emoji: move.emoji,
        title: move.daysLeft === 0 ? `${move.label} is due today` : `${move.label} due ${relativeDatePhrase(move.date, today)}`,
        detail:
          move.source === "automation"
            ? "Owwy logs it for you automatically"
            : move.daysLeft === 0
              ? "Mark it paid once it's done"
              : `${move.daysLeft} ${move.daysLeft === 1 ? "day" : "days"} left`,
        href: hrefFor(move),
        priority: 80 - move.daysLeft,
        amount: move.amount,
      });
    }
  }

  for (const rule of pending) {
    reminders.push({ id: `confirm:${rule.id}:${rule.nextDate}`, kind: "confirm", emoji: rule.type === "income" ? "💰" : "🔁", title: `Confirm “${rule.name}”`, detail: "Waiting for your OK before logging", href: "/", priority: 70, amount: rule.amount });
  }

  for (const b of input.budgets) {
    if (b.budget.paused || b.status !== "over") continue;
    const name = b.category?.name ?? "A budget";
    reminders.push({ id: `budget:${b.budget.id}:${input.month}`, kind: "budget", emoji: b.category?.emoji ?? "🎯", title: `${name} is over budget`, detail: `${Math.round(b.percent)}% of this month's limit used`, href: "/budgets/", priority: 60 });
  }

  for (const r of input.receivables) {
    if (r.status !== "overdue") continue;
    reminders.push({ id: `collect:${r.receivable.id}`, kind: "collect", emoji: "🤝", title: `${r.receivable.person} hasn't paid you back`, detail: "Past the date you agreed", href: "/owed/", priority: 50, amount: r.remaining });
  }

  const reviewMonth = addMonthKey(input.month, -1);
  if (input.snapshots.some((s) => s.id === reviewMonth && !s.seen)) {
    reminders.push({ id: `review:${reviewMonth}`, kind: "review", emoji: "🦉", title: `Your ${monthName(reviewMonth)} review is ready`, detail: "A one-minute look back", href: `/review/?month=${reviewMonth}`, priority: 30 });
  }

  if (input.paydayDaysLeft === 1) {
    reminders.push({ id: `payday:${today}`, kind: "payday", emoji: "🗓️", title: "Payday is tomorrow", detail: "Plan where it goes before it arrives", href: "/safe-to-spend/", priority: 10 });
  }

  return reminders.sort((a, b) => b.priority - a.priority);
}

function hrefFor(move: MoneyMove): string {
  switch (move.source) {
    case "bill":
      return "/bills/";
    case "credit":
      return "/accounts/";
    case "debt":
      return "/debts/";
    case "automation":
      return "/recurring/";
    case "receivable":
      return "/owed/";
  }
}

/** A short, warm line for the top of the reminders sheet. */
export function remindersHeadline(reminders: readonly Reminder[]): string {
  if (!reminders.length) return "All quiet in the nest. Nothing needs you right now.";
  const urgent = reminders.filter((r) => r.kind === "overdue").length;
  if (urgent) return urgent === 1 ? "One thing slipped past its date — let's sort it out." : `${urgent} things slipped past their dates — let's sort them out.`;
  if (reminders.length === 1) return "Just one small thing on my list for you.";
  return `${reminders.length} little things on my list for you.`;
}
