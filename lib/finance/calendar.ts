import { addDays, monthEnd, monthKey, monthStart, startOfWeek } from "@/lib/dates";
import type {
  Account,
  Bill,
  Category,
  ID,
  IncomeSchedule,
  ISODate,
  Minor,
  MonthKey,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from "@/types/models";
import { billOccurrences } from "./bills";
import type { DebtProgress } from "./debts";
import { upcomingRecurring } from "./recurring";
import { nextScheduledPayday } from "./schedule";
import { savingsDelta } from "./summary";

export type CalendarEventKind = "income" | "expense" | "transfer" | "savings" | "bill" | "expectedIncome" | "scheduled" | "debt";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  date: ISODate;
  label: string;
  emoji: string;
  /** Always positive; `direction` tells whether money comes in or goes out. */
  amount: Minor | null;
  direction: "in" | "out" | "neutral";
  /** Future items that haven't happened yet. */
  projected: boolean;
  refId: ID;
}

export interface CalendarDay {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  events: CalendarEvent[];
  spent: Minor;
  income: Minor;
  /** Projected bills/payments still due that day. */
  due: Minor;
  /** Projected spendable balance at the end of the day (future days only). */
  projectedBalance: Minor | null;
}

export interface MoneyCalendar {
  month: MonthKey;
  weeks: CalendarDay[][];
  days: Map<ISODate, CalendarDay>;
  totals: { spent: Minor; income: Minor; dueRemaining: Minor };
}

export interface CalendarInput {
  month: MonthKey;
  today: ISODate;
  weekStartsOn: 0 | 1;
  transactions: readonly Transaction[];
  accounts: readonly Account[];
  categories: readonly Category[];
  goals: readonly SavingsGoal[];
  bills: readonly Bill[];
  recurring: readonly RecurringTransaction[];
  debtProgress: readonly DebtProgress[];
  income: IncomeSchedule;
  spendableBalance: Minor;
  spendableAccountIds: readonly ID[];
}

export function buildMoneyCalendar(input: CalendarInput): MoneyCalendar {
  const { month, today } = input;
  const first = monthStart(month);
  const last = monthEnd(month);
  const gridStart = startOfWeek(first, input.weekStartsOn);
  const gridEnd = addDays(startOfWeek(last, input.weekStartsOn), 6);

  const categoriesById = new Map(input.categories.map((c) => [c.id, c]));
  const accountsById = new Map(input.accounts.map((a) => [a.id, a]));
  const goalsById = new Map(input.goals.map((g) => [g.id, g]));
  const spendable = new Set(input.spendableAccountIds);
  const events = new Map<ISODate, CalendarEvent[]>();
  const push = (event: CalendarEvent) => {
    const list = events.get(event.date);
    if (list) list.push(event);
    else events.set(event.date, [event]);
  };

  // Recorded activity.
  for (const tx of input.transactions) {
    if (tx.date < gridStart || tx.date > gridEnd) continue;
    const category = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
    if (tx.type === "transfer") {
      const delta = savingsDelta(tx, accountsById, goalsById);
      const to = tx.toAccountId ? accountsById.get(tx.toAccountId) : undefined;
      push({
        id: tx.id,
        kind: delta !== 0 ? "savings" : "transfer",
        date: tx.date,
        label: tx.note || (delta > 0 ? `Saved to ${to?.name ?? "savings"}` : `Transfer to ${to?.name ?? "account"}`),
        emoji: delta !== 0 ? "🐷" : "🔁",
        amount: tx.amount,
        direction: "neutral",
        projected: false,
        refId: tx.id,
      });
    } else {
      push({
        id: tx.id,
        kind: tx.type,
        date: tx.date,
        label: tx.note || category?.name || (tx.type === "income" ? "Income" : "Expense"),
        emoji: category?.emoji ?? (tx.type === "income" ? "💰" : "🧾"),
        amount: tx.amount,
        direction: tx.type === "income" ? "in" : "out",
        projected: false,
        refId: tx.id,
      });
    }
  }

  // Projected items from today onward.
  const projectionStart = today > gridStart ? today : gridStart;
  if (projectionStart <= gridEnd) {
    for (const o of billOccurrences(input.bills, projectionStart, gridEnd, false)) {
      push({
        id: `bill:${o.bill.id}:${o.date}`,
        kind: "bill",
        date: o.date,
        label: o.bill.name,
        emoji: o.bill.emoji,
        amount: o.amount,
        direction: "out",
        projected: true,
        refId: o.bill.id,
      });
    }
    // Overdue bills surface on today.
    for (const bill of input.bills) {
      if (bill.active && bill.nextDueDate < today && today >= gridStart && today <= gridEnd) {
        push({
          id: `bill:${bill.id}:overdue`,
          kind: "bill",
          date: today,
          label: `${bill.name} (overdue)`,
          emoji: bill.emoji,
          amount: bill.amount,
          direction: "out",
          projected: true,
          refId: bill.id,
        });
      }
    }

    for (const { rule, date } of upcomingRecurring(input.recurring, projectionStart, gridEnd)) {
      push({
        id: `rec:${rule.id}:${date}`,
        kind: rule.type === "income" ? "expectedIncome" : "scheduled",
        date,
        label: rule.name,
        emoji: rule.type === "income" ? "💰" : rule.type === "transfer" ? "🔁" : (categoriesById.get(rule.categoryId ?? "")?.emoji ?? "🗓️"),
        amount: rule.amount,
        direction: rule.type === "income" ? "in" : rule.type === "transfer" ? "neutral" : "out",
        projected: true,
        refId: rule.id,
      });
    }

    // Paydays from the income schedule when no recurring income rule exists.
    if (!input.recurring.some((r) => r.active && r.type === "income")) {
      let payday = nextScheduledPayday(input.income, addDays(projectionStart, -1));
      let guard = 0;
      while (payday <= gridEnd && guard < 10) {
        push({
          id: `payday:${payday}`,
          kind: "expectedIncome",
          date: payday,
          label: "Payday",
          emoji: "💰",
          amount: null,
          direction: "in",
          projected: true,
          refId: payday,
        });
        payday = nextScheduledPayday(input.income, payday);
        guard++;
      }
    }

    for (const p of input.debtProgress) {
      const due = p.debt.nextDueDate;
      if (!due || p.remaining === 0 || p.debt.archived || due < projectionStart || due > gridEnd) continue;
      push({
        id: `debt:${p.debt.id}:${due}`,
        kind: "debt",
        date: due,
        label: `${p.debt.name} payment`,
        emoji: "💳",
        amount: p.debt.minimumPayment,
        direction: "out",
        projected: true,
        refId: p.debt.id,
      });
    }
  }

  // Walk the grid, accumulating projected balance for future days.
  const days = new Map<ISODate, CalendarDay>();
  const weeks: CalendarDay[][] = [];
  let running = input.spendableBalance;
  const totals = { spent: 0, income: 0, dueRemaining: 0 };

  for (let date = gridStart, i = 0; date <= gridEnd; date = addDays(date, 1), i++) {
    const dayEvents = (events.get(date) ?? []).sort((a, b) => Number(a.projected) - Number(b.projected));
    let spent = 0;
    let income = 0;
    let due = 0;
    for (const e of dayEvents) {
      if (!e.projected && e.kind === "expense") spent += e.amount ?? 0;
      if (!e.projected && e.kind === "income") income += e.amount ?? 0;
      if (e.projected && e.direction === "out") due += e.amount ?? 0;
    }

    let projectedBalance: Minor | null = null;
    if (date >= today) {
      for (const e of dayEvents) {
        if (!e.projected || e.amount === null) continue;
        if (e.direction === "out" && affectsSpendable(e, input, spendable)) running -= e.amount;
        if (e.direction === "in" && e.kind === "expectedIncome") running += e.amount;
      }
      projectedBalance = running;
    }

    const inMonth = monthKey(date) === month;
    if (inMonth) {
      totals.spent += spent;
      totals.income += income;
      if (date >= today) totals.dueRemaining += due;
    }

    const day: CalendarDay = {
      date,
      inMonth,
      isToday: date === today,
      isPast: date < today,
      events: dayEvents,
      spent,
      income,
      due,
      projectedBalance,
    };
    days.set(date, day);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day);
  }

  return { month, weeks, days, totals };
}

function affectsSpendable(event: CalendarEvent, input: CalendarInput, spendable: Set<ID>): boolean {
  if (event.kind === "bill") {
    const bill = input.bills.find((b) => b.id === event.refId);
    return !bill?.accountId || spendable.has(bill.accountId);
  }
  if (event.kind === "scheduled") {
    const rule = input.recurring.find((r) => r.id === event.refId);
    return rule ? spendable.has(rule.accountId) : false;
  }
  return true;
}
