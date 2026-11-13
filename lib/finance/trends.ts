import { addDays, addMonthKey, daysInMonth, monthEnd, monthKey, monthStart } from "@/lib/dates";
import { accountCurrency, toBase, type FxContext } from "@/lib/money/fx";
import type { Account, Bill, Debt, ID, ISODate, Minor, MonthKey, RecurringTransaction, SavingsGoal, Transaction } from "@/types/models";
import { isLiability } from "./balances";
import { billOccurrences } from "./bills";
import { upcomingRecurring } from "./recurring";
import { summarizeMonth } from "./summary";

export interface TrendPoint {
  key: string;
  label: string;
  value: Minor;
}

/**
 * Net worth at the end of each period: account balances (assets minus credit
 * owed) using only transactions up to that date, minus standalone debts.
 */
export function netWorthHistory(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  debts: readonly Debt[],
  ends: readonly { key: string; label: string; date: ISODate }[],
  fx?: FxContext,
): TrendPoint[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const balances = new Map<ID, Minor>(accounts.map((a) => [a.id, a.openingBalance]));
  const debtPaid = new Map<ID, Minor>();
  const standalone = debts.filter((d) => !d.accountId);
  let cursor = 0;

  return ends.map((end) => {
    while (cursor < sorted.length && sorted[cursor].date <= end.date) {
      const t = sorted[cursor++];
      const change = (id: ID | undefined, delta: Minor) => {
        if (id && balances.has(id)) balances.set(id, (balances.get(id) ?? 0) + delta);
      };
      if (t.type === "income") change(t.accountId, t.amount);
      else if (t.type === "expense") change(t.accountId, -t.amount);
      else {
        change(t.accountId, -t.amount);
        change(t.toAccountId, t.toAmount ?? t.amount);
      }
      if (t.debtId) debtPaid.set(t.debtId, (debtPaid.get(t.debtId) ?? 0) + t.amount);
    }
    let value = 0;
    for (const account of accounts) {
      if (account.archived) continue;
      const native = balances.get(account.id) ?? 0;
      const balance = fx ? toBase(native, accountCurrency(account, fx), fx) : native;
      value += isLiability(account) ? Math.min(0, balance) : balance;
    }
    for (const debt of standalone) {
      if (debt.archived || new Date(debt.createdAt).toISOString().slice(0, 10) > end.date) continue;
      value -= Math.max(0, debt.startingBalance - (debtPaid.get(debt.id) ?? 0));
    }
    return { key: end.key, label: end.label, value };
  });
}

/** One account's end-of-day balance (in its own currency) for each date, oldest first. */
export function accountBalanceHistory(account: Account, transactions: readonly Transaction[], dates: readonly ISODate[]): Minor[] {
  const sorted = transactions.filter((t) => t.accountId === account.id || t.toAccountId === account.id).sort((a, b) => a.date.localeCompare(b.date));
  let balance = account.openingBalance;
  let cursor = 0;
  return dates.map((date) => {
    while (cursor < sorted.length && sorted[cursor].date <= date) {
      const t = sorted[cursor++];
      if (t.type === "income" && t.accountId === account.id) balance += t.amount;
      else if (t.type === "expense" && t.accountId === account.id) balance -= t.amount;
      else if (t.type === "transfer") {
        if (t.accountId === account.id) balance -= t.amount;
        if (t.toAccountId === account.id) balance += t.toAmount ?? t.amount;
      }
    }
    return balance;
  });
}

export type TrendGranularity = "daily" | "monthly" | "annually";

/** Period end dates for the chosen granularity, oldest first. */
export function periodEnds(granularity: TrendGranularity, today: ISODate, count?: number): { key: string; label: string; date: ISODate }[] {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (granularity === "daily") {
    const n = count ?? 30;
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(today, i - (n - 1));
      return { key: date, label: String(Number(date.slice(8, 10))), date };
    });
  }
  if (granularity === "monthly") {
    const n = count ?? 12;
    const current = monthKey(today);
    return Array.from({ length: n }, (_, i) => {
      const m = addMonthKey(current, i - (n - 1));
      const end = monthEnd(m);
      return { key: m, label: MONTHS[Number(m.slice(5, 7)) - 1], date: end < today ? end : today };
    });
  }
  const n = count ?? 5;
  const year = Number(today.slice(0, 4));
  return Array.from({ length: n }, (_, i) => {
    const y = year - (n - 1) + i;
    const end = `${y}-12-31`;
    return { key: String(y), label: String(y), date: end < today ? end : today };
  });
}

export interface CashFlowPoint {
  month: MonthKey;
  label: string;
  income: Minor;
  spent: Minor;
  saved: Minor;
  net: Minor;
}

export function cashFlowHistory(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  goals: readonly SavingsGoal[],
  today: ISODate,
  months = 6,
): CashFlowPoint[] {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const current = monthKey(today);
  return Array.from({ length: months }, (_, i) => {
    const month = addMonthKey(current, i - (months - 1));
    const s = summarizeMonth(transactions, accounts, goals, month);
    return { month, label: MONTHS[Number(month.slice(5, 7)) - 1], income: s.income, spent: s.spent, saved: s.saved, net: s.net };
  });
}

export interface ProjectionPoint {
  month: MonthKey;
  label: string;
  income: Minor;
  scheduled: Minor;
  everyday: Minor;
  balance: Minor;
}

export interface ProjectionInput {
  today: ISODate;
  startBalance: Minor;
  transactions: readonly Transaction[];
  recurring: readonly RecurringTransaction[];
  bills: readonly Bill[];
  months?: number;
}

/**
 * A simple, explainable projection of total balance over the next months:
 * scheduled income and payments (automations, bills) plus everyday spending
 * at the average of the last three full months.
 */
export function projectBalance(input: ProjectionInput): { points: ProjectionPoint[]; everydayAverage: Minor; incomeAverage: Minor } {
  const months = input.months ?? 6;
  const current = monthKey(input.today);
  const recurringIds = new Set(input.recurring.map((r) => r.id));

  let everydayTotal = 0;
  let incomeTotal = 0;
  let monthsWithData = 0;
  for (let i = 1; i <= 3; i++) {
    const m = addMonthKey(current, -i);
    const start = monthStart(m);
    const end = monthEnd(m);
    const inMonth = input.transactions.filter((t) => t.date >= start && t.date <= end);
    if (!inMonth.length) continue;
    monthsWithData++;
    everydayTotal += inMonth.filter((t) => t.type === "expense" && !t.billId && !(t.recurringId && recurringIds.has(t.recurringId))).reduce((s, t) => s + t.amount, 0);
    incomeTotal += inMonth.filter((t) => t.type === "income" && !(t.recurringId && recurringIds.has(t.recurringId))).reduce((s, t) => s + t.amount, 0);
  }
  const everydayAverage = monthsWithData ? Math.round(everydayTotal / monthsWithData) : 0;
  const incomeAverage = monthsWithData ? Math.round(incomeTotal / monthsWithData) : 0;

  const points: ProjectionPoint[] = [];
  let balance = input.startBalance;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < months; i++) {
    const month = addMonthKey(current, i);
    const from = i === 0 ? addDays(input.today, 1) : monthStart(month);
    const to = monthEnd(month);
    const [y, m] = month.split("-").map(Number);
    const share = i === 0 ? (daysInMonth(y, m) - Number(input.today.slice(8, 10))) / daysInMonth(y, m) : 1;

    let income = Math.round(incomeAverage * share);
    let scheduled = 0;
    for (const { rule } of upcomingRecurring(input.recurring, from, to)) {
      if (rule.type === "income") income += rule.amount;
      else if (rule.type === "expense") scheduled += rule.amount;
    }
    for (const o of billOccurrences(input.bills, from, to, false)) scheduled += o.amount;
    const everyday = Math.round(everydayAverage * share);
    balance += income - scheduled - everyday;
    points.push({ month, label: MONTHS[m - 1], income, scheduled, everyday, balance });
  }
  return { points, everydayAverage, incomeAverage };
}
