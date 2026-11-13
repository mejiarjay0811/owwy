import { addDays, daysInMonth, diffDays, makeDate, parseISODate } from "@/lib/dates";
import type { Account, Bill, ID, ISODate, Minor, RecurringTransaction } from "@/types/models";
import { billOccurrences } from "./bills";
import type { DebtProgress } from "./debts";
import type { ReceivableProgress } from "./receivables";
import { upcomingRecurring } from "./recurring";

export type MoneyMoveSource = "bill" | "automation" | "credit" | "debt" | "receivable";

export interface MoneyMove {
  id: string;
  direction: "in" | "out";
  source: MoneyMoveSource;
  refId: ID;
  label: string;
  emoji: string;
  date: ISODate;
  amount: Minor;
  daysLeft: number;
  /** Past its date and still not handled. */
  overdue: boolean;
}

export interface UpcomingInput {
  today: ISODate;
  days: number;
  bills: readonly Bill[];
  recurring: readonly RecurringTransaction[];
  accounts: readonly Account[];
  balances: Map<ID, Minor>;
  debtProgress: readonly DebtProgress[];
  receivables: readonly ReceivableProgress[];
}

/**
 * Planned and recurring money moves in the next `days`: income that's coming in
 * and everything that has to go out — bills, automations, card due dates, loans.
 */
export function upcomingMoneyMoves(input: UpcomingInput): { income: MoneyMove[]; expenses: MoneyMove[] } {
  const { today } = input;
  const end = addDays(today, input.days);
  const moves: MoneyMove[] = [];
  const add = (move: Omit<MoneyMove, "daysLeft" | "overdue">) => {
    const daysLeft = diffDays(today, move.date);
    moves.push({ ...move, daysLeft, overdue: daysLeft < 0 });
  };

  for (const o of billOccurrences(input.bills, today, end)) {
    add({ id: `bill:${o.bill.id}:${o.date}`, direction: "out", source: "bill", refId: o.bill.id, label: o.bill.name, emoji: o.bill.emoji, date: o.date, amount: o.amount });
  }

  for (const { rule, date } of upcomingRecurring(input.recurring, today, end)) {
    if (rule.type === "transfer") continue;
    add({
      id: `rec:${rule.id}:${date}`,
      direction: rule.type === "income" ? "in" : "out",
      source: "automation",
      refId: rule.id,
      label: rule.name,
      emoji: rule.type === "income" ? "💰" : "🔁",
      date,
      amount: rule.amount,
    });
  }
  // "Ask first" automations that are already due.
  for (const rule of input.recurring) {
    if (rule.active && rule.mode === "confirm" && rule.nextDate < today && rule.type !== "transfer") {
      add({ id: `rec:${rule.id}:${rule.nextDate}`, direction: rule.type === "income" ? "in" : "out", source: "automation", refId: rule.id, label: rule.name, emoji: "🔁", date: rule.nextDate, amount: rule.amount });
    }
  }

  // Credit cards with a statement due day and a balance owed.
  const linkedDebtAccounts = new Set(input.debtProgress.map((d) => d.debt.accountId).filter(Boolean));
  for (const account of input.accounts) {
    if (account.archived || account.type !== "credit" || !account.dueDay || linkedDebtAccounts.has(account.id)) continue;
    const owed = Math.max(0, -(input.balances.get(account.id) ?? 0));
    if (!owed) continue;
    const date = nextDayOfMonth(today, account.dueDay);
    if (date <= end) add({ id: `card:${account.id}:${date}`, direction: "out", source: "credit", refId: account.id, label: `${account.name} due`, emoji: "💳", date, amount: owed });
  }

  for (const p of input.debtProgress) {
    const due = p.debt.nextDueDate;
    if (!due || p.remaining === 0 || p.debt.archived || due > end || p.minimumMetThisMonth) continue;
    add({ id: `debt:${p.debt.id}:${due}`, direction: "out", source: "debt", refId: p.debt.id, label: `${p.debt.name} payment`, emoji: "💳", date: due, amount: Math.min(p.remaining, p.debt.minimumPayment || p.remaining) });
  }

  for (const r of input.receivables) {
    const due = r.receivable.dueDate;
    if (!due || r.remaining === 0 || r.status === "closed" || due > end) continue;
    add({ id: `recv:${r.receivable.id}`, direction: "in", source: "receivable", refId: r.receivable.id, label: `${r.receivable.person} pays back`, emoji: "🤝", date: due, amount: r.remaining });
  }

  const byDate = (a: MoneyMove, b: MoneyMove) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label);
  return {
    income: moves.filter((m) => m.direction === "in").sort(byDate),
    expenses: moves.filter((m) => m.direction === "out").sort(byDate),
  };
}

/** The next date (today or later) falling on `day` of a month, clamped to month length. */
export function nextDayOfMonth(today: ISODate, day: number): ISODate {
  const { y, m } = parseISODate(today);
  const thisMonth = makeDate(y, m, Math.min(day, daysInMonth(y, m)));
  if (thisMonth >= today) return thisMonth;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return makeDate(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}
