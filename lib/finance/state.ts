import { addDays, addMonthKey, daysInMonth, monthKey, monthStart } from "@/lib/dates";
import { hasForeignAccounts, toBaseBalances, toBaseTransactions, type FxContext } from "@/lib/money/fx";
import type { Account, Category, ID, ISODate, Minor, MonthKey, OwwyDataset, Transaction } from "@/types/models";
import { computeBalances, computeTotals, type BalanceTotals } from "./balances";
import { billOccurrences, type BillOccurrence } from "./bills";
import { computeBudgetProgress, computeBudgetTotals, monthElapsedPercent, type BudgetProgress, type BudgetTotals } from "./budgets";
import { computeDebtProgress, type DebtProgress } from "./debts";
import { computeGoalProgress, type GoalProgress } from "./goals";
import { computeNetWorth, type NetWorth } from "./net-worth";
import { computePayday, type PaydayInfo } from "./payday";
import { computeReceivableProgress, totalStillToCollect, type ReceivableProgress } from "./receivables";
import { computeSafeToSpend, type SafeToSpendResult } from "./safe-to-spend";
import { sortTransactions } from "./search";
import { summarizeMonth, summarizePeriod, type PeriodSummary } from "./summary";
import { upcomingMoneyMoves, type MoneyMove } from "./upcoming";

/** How far ahead "Upcoming" looks on the dashboard and bills screen. */
export const UPCOMING_WINDOW_DAYS = 30;

export interface FinanceState {
  today: ISODate;
  month: MonthKey;
  fx: FxContext;
  /** True when at least one account uses another currency. */
  multiCurrency: boolean;
  accounts: Account[];
  activeAccounts: Account[];
  /** Active accounts in the main currency — the only ones bills, goals, debts and automations use. */
  mainAccounts: Account[];
  categories: Category[];
  accountsById: Map<ID, Account>;
  categoriesById: Map<ID, Category>;
  /** Balances in each account's own currency. */
  balances: Map<ID, Minor>;
  /** Balances converted to the main currency. */
  baseBalances: Map<ID, Minor>;
  totals: BalanceTotals;
  /** Newest first, amounts in each account's own currency (for lists). */
  transactions: Transaction[];
  /** Newest first, amounts in the main currency (for totals and analysis). */
  baseTransactions: Transaction[];
  thisMonth: PeriodSummary;
  lastMonth: PeriodSummary;
  /** Last month up to the same day number, for fair comparisons. */
  lastMonthToDate: PeriodSummary;
  spentToday: Minor;
  budgetProgress: BudgetProgress[];
  budgetTotals: BudgetTotals;
  goalProgress: GoalProgress[];
  debtProgress: DebtProgress[];
  receivableProgress: ReceivableProgress[];
  stillToCollect: Minor;
  upcomingBills: BillOccurrence[];
  upcoming: { income: MoneyMove[]; expenses: MoneyMove[] };
  payday: PaydayInfo;
  safeToSpend: SafeToSpendResult;
  netWorth: NetWorth;
  monthElapsed: number;
}

/** Derives everything the UI shows from the raw dataset in one deterministic pass. */
export function computeFinanceState(data: OwwyDataset, today: ISODate): FinanceState {
  const month = monthKey(today);
  const fx: FxContext = { base: data.settings.currency, rates: data.settings.exchangeRates ?? {} };
  const accounts = [...data.accounts].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const activeAccounts = accounts.filter((a) => !a.archived);
  const categories = [...data.categories].sort((a, b) => a.order - b.order);
  const receivables = data.receivables ?? [];

  const balances = computeBalances(accounts, data.transactions);
  const multiCurrency = hasForeignAccounts(accounts, fx);
  const baseBalances = multiCurrency ? toBaseBalances(balances, accountsById, fx) : balances;
  const baseTx = toBaseTransactions(data.transactions, accountsById, fx);
  const totals = computeTotals(accounts, baseBalances);

  const thisMonth = summarizeMonth(baseTx, accounts, data.goals, month);
  const lastMonthKey = addMonthKey(month, -1);
  const lastMonth = summarizeMonth(baseTx, accounts, data.goals, lastMonthKey);
  const [ly, lm] = lastMonthKey.split("-").map(Number);
  const sameDay = Math.min(Number(today.slice(8, 10)), daysInMonth(ly, lm));
  const lastMonthToDate = summarizePeriod(baseTx, accounts, data.goals, monthStart(lastMonthKey), `${lastMonthKey}-${String(sameDay).padStart(2, "0")}`);

  const budgetProgress = computeBudgetProgress(data.budgets, categories, thisMonth.byCategory, month, today);
  // Goals and debts live in main-currency accounts, so their own amounts are used as-is.
  const goalProgress = data.goals
    .filter((g) => !g.archived)
    .map((g) => computeGoalProgress(g, data.transactions, today))
    .sort((a, b) => Number(a.pace === "complete") - Number(b.pace === "complete") || a.goal.createdAt - b.goal.createdAt);
  const debtProgress = data.debts.filter((d) => !d.archived).map((d) => computeDebtProgress(d, data.transactions, balances, today));
  const receivableProgress = receivables
    .filter((r) => !r.archived)
    .map((r) => computeReceivableProgress(r, data.transactions, today))
    .sort((a, b) => Number(a.remaining === 0) - Number(b.remaining === 0) || b.receivable.createdAt - a.receivable.createdAt);

  const upcomingBills = billOccurrences(data.bills, today, addDays(today, UPCOMING_WINDOW_DAYS));
  const upcoming = upcomingMoneyMoves({
    today,
    days: UPCOMING_WINDOW_DAYS,
    bills: data.bills,
    recurring: data.recurring,
    accounts,
    balances: baseBalances,
    debtProgress,
    receivables: receivableProgress,
  });

  const safeToSpend = computeSafeToSpend({
    today,
    settings: data.settings,
    accounts,
    balances: baseBalances,
    bills: data.bills,
    recurring: data.recurring,
    goals: data.goals,
    goalProgress,
    debtProgress,
    transactions: baseTx,
    savedThisMonth: thisMonth.saved,
  });

  return {
    today,
    month,
    fx,
    multiCurrency,
    accounts,
    activeAccounts,
    mainAccounts: activeAccounts.filter((a) => !a.currency || a.currency === fx.base),
    categories,
    accountsById,
    categoriesById: new Map(categories.map((c) => [c.id, c])),
    balances,
    baseBalances,
    totals,
    transactions: sortTransactions([...data.transactions]),
    baseTransactions: multiCurrency ? sortTransactions([...baseTx]) : sortTransactions([...data.transactions]),
    thisMonth,
    lastMonth,
    lastMonthToDate,
    spentToday: thisMonth.byDay.get(today) ?? 0,
    budgetProgress,
    budgetTotals: computeBudgetTotals(budgetProgress),
    goalProgress,
    debtProgress,
    receivableProgress,
    stillToCollect: totalStillToCollect(receivableProgress),
    upcomingBills,
    upcoming,
    payday: computePayday(data.settings.income, data.recurring, baseTx, today),
    safeToSpend,
    netWorth: computeNetWorth(accounts, baseBalances, debtProgress, receivableProgress),
    monthElapsed: monthElapsedPercent(month, today),
  };
}
