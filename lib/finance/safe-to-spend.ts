import { addDays, diffDays, maxDate, monthEnd, monthKey } from "@/lib/dates";
import type {
  Account,
  AppSettings,
  Bill,
  ID,
  ISODate,
  Minor,
  RecurringTransaction,
  SavingsGoal,
  Transaction,
} from "@/types/models";
import { isLiability } from "./balances";
import { billOccurrences } from "./bills";
import type { DebtProgress } from "./debts";
import type { GoalProgress } from "./goals";
import { upcomingRecurring } from "./recurring";
import { nextIncomeDate } from "./schedule";

export type SafeToSpendLineKey = "available" | "bills" | "debts" | "savings" | "goals" | "minimum" | "buffer";

export interface SafeToSpendItem {
  label: string;
  date?: ISODate;
  amount: Minor;
}

export interface SafeToSpendLine {
  key: SafeToSpendLineKey;
  label: string;
  /** Positive for money available, positive for deductions too (shown with −). */
  amount: Minor;
  explanation: string;
  items: SafeToSpendItem[];
}

export type SafeToSpendStatus = "healthy" | "tight" | "short" | "atRisk";

export interface SafeToSpendResult {
  amount: Minor;
  /** Negative when commitments exceed spendable money. */
  rawAmount: Minor;
  available: Minor;
  /** Bills + debt minimums + scheduled payments before next income. */
  committed: Minor;
  lines: SafeToSpendLine[];
  nextIncomeDate: ISODate;
  /** Last day covered by this estimate (day before next income). */
  periodEnd: ISODate;
  daysLeft: number;
  perDay: Minor;
  status: SafeToSpendStatus;
  spendableAccountIds: ID[];
}

export interface SafeToSpendInput {
  today: ISODate;
  settings: Pick<AppSettings, "income" | "safeToSpend">;
  accounts: readonly Account[];
  balances: Map<ID, Minor>;
  bills: readonly Bill[];
  recurring: readonly RecurringTransaction[];
  goals: readonly SavingsGoal[];
  goalProgress: readonly GoalProgress[];
  debtProgress: readonly DebtProgress[];
  transactions: readonly Transaction[];
  /** Net amount already moved to savings this month. */
  savedThisMonth: Minor;
}

/**
 * Safe-to-Spend answers "how much can I spend until my next income without
 * putting bills, savings or my cushion at risk?"
 *
 *   spendable balances
 *   − unpaid bills & scheduled payments due before next income
 *   − minimum debt payments due before next income
 *   − the part of this month's savings plan still to set aside
 *   − goal money that sits inside spendable accounts
 *   − minimum balance
 *   − cushion (percent of what's left, or fixed)
 *   = safe to spend
 */
export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const { today, settings, accounts, balances } = input;
  const config = settings.safeToSpend;

  const spendable = accounts.filter((a) => !a.archived && a.includeInSafeToSpend && !isLiability(a));
  const spendableIds = new Set(spendable.map((a) => a.id));
  const available = spendable.reduce((total, a) => total + (balances.get(a.id) ?? 0), 0);

  const incomeDate = nextIncomeDate(settings.income, input.recurring, today);
  const periodEnd = maxDate(today, addDays(incomeDate, -1));
  const daysLeft = Math.max(1, diffDays(today, incomeDate));

  // Bills and scheduled payments leaving spendable accounts before income arrives.
  const billItems: SafeToSpendItem[] = billOccurrences(input.bills, today, periodEnd)
    .filter((o) => !o.bill.accountId || spendableIds.has(o.bill.accountId))
    .map((o) => ({ label: `${o.bill.emoji} ${o.bill.name}`, date: o.date, amount: o.amount }));

  const scheduled = upcomingRecurring(input.recurring, today, periodEnd).filter(({ rule }) =>
    spendableIds.has(rule.accountId),
  );
  const savingsAccountIds = new Set(accounts.filter((a) => !spendableIds.has(a.id)).map((a) => a.id));
  let scheduledSavings = 0;
  for (const { rule, date } of scheduled) {
    if (rule.type === "expense") {
      billItems.push({ label: rule.name, date, amount: rule.amount });
    } else if (rule.type === "transfer" && rule.toAccountId && savingsAccountIds.has(rule.toAccountId)) {
      scheduledSavings += rule.amount;
    }
  }
  billItems.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const billsTotal = sumItems(billItems);

  const debtItems: SafeToSpendItem[] = input.debtProgress
    .filter(
      (p) =>
        !p.debt.archived &&
        p.remaining > 0 &&
        p.debt.minimumPayment > 0 &&
        p.debt.nextDueDate !== undefined &&
        p.debt.nextDueDate <= periodEnd,
    )
    .map((p) => ({
      label: p.debt.name,
      date: p.debt.nextDueDate,
      amount: Math.min(p.remaining, Math.max(0, p.debt.minimumPayment - p.paidThisMonth)),
    }))
    .filter((item) => item.amount > 0);
  const debtsTotal = sumItems(debtItems);

  // Savings plan: explicit monthly target, or what active goals need per month.
  const monthlyTarget =
    config.monthlySavingsTarget > 0
      ? config.monthlySavingsTarget
      : config.useGoalSuggestions
        ? input.goalProgress
            .filter((p) => !p.goal.archived && p.remaining > 0 && !spendableIds.has(p.goal.accountId))
            .reduce((t, p) => t + p.requiredMonthly, 0)
        : 0;
  const stillToSave = Math.max(0, monthlyTarget - Math.max(0, input.savedThisMonth));
  // Spread what's left of the plan over the rest of the month, reserving this period's share.
  const daysToMonthEnd = diffDays(today, monthEnd(monthKey(today))) + 1;
  const share = Math.min(1, daysLeft / Math.max(1, daysToMonthEnd));
  // Scheduled automatic transfers to savings already cover part of the plan.
  const savingsReserve = Math.max(scheduledSavings, Math.round(stillToSave * share));

  // Goal money already parked inside spendable accounts isn't free to spend.
  const goalItems: SafeToSpendItem[] = input.goalProgress
    .filter((p) => !p.goal.archived && spendableIds.has(p.goal.accountId) && p.saved > 0)
    .map((p) => ({ label: `${p.goal.emoji} ${p.goal.name}`, amount: p.saved }));
  const goalsTotal = sumItems(goalItems);

  const minimum = Math.max(0, config.minimumBalance);
  const beforeBuffer = available - billsTotal - debtsTotal - savingsReserve - goalsTotal - minimum;
  const buffer =
    beforeBuffer <= 0
      ? 0
      : config.bufferMode === "fixed"
        ? Math.min(beforeBuffer, Math.max(0, config.bufferAmount))
        : Math.round((beforeBuffer * clamp(config.bufferPercent, 0, 50)) / 100);

  const rawAmount = beforeBuffer - buffer;
  const amount = Math.max(0, rawAmount);
  const committed = billsTotal + debtsTotal;

  const lines: SafeToSpendLine[] = [
    {
      key: "available",
      label: "Money in spending accounts",
      amount: available,
      explanation: `${spendable.length} account${spendable.length === 1 ? "" : "s"} you use for everyday spending.`,
      items: spendable.map((a) => ({ label: a.name, amount: balances.get(a.id) ?? 0 })),
    },
    {
      key: "bills",
      label: "Upcoming bills",
      amount: billsTotal,
      explanation: "Unpaid bills and scheduled payments due before your next income.",
      items: billItems,
    },
    {
      key: "debts",
      label: "Debt payments",
      amount: debtsTotal,
      explanation: "Minimum payments still due before your next income.",
      items: debtItems,
    },
    {
      key: "savings",
      label: "Planned savings",
      amount: savingsReserve,
      explanation:
        monthlyTarget > 0
          ? `Part of your monthly savings plan still to set aside this pay period.`
          : "No savings plan yet. Add a goal or a monthly target to reserve savings first.",
      items: [],
    },
    {
      key: "goals",
      label: "Set aside for goals",
      amount: goalsTotal,
      explanation: "Goal money kept inside your spending accounts.",
      items: goalItems,
    },
    {
      key: "minimum",
      label: "Minimum balance",
      amount: minimum,
      explanation: "The amount you never want your spending accounts to go below.",
      items: [],
    },
    {
      key: "buffer",
      label: "Cushion",
      amount: buffer,
      explanation:
        config.bufferMode === "fixed"
          ? "A fixed cushion for surprises."
          : `${clamp(config.bufferPercent, 0, 50)}% of what's left, kept for surprises.`,
      items: [],
    },
  ];

  let status: SafeToSpendStatus;
  if (available - committed < 0) status = "atRisk";
  else if (rawAmount <= 0) status = "short";
  else if (rawAmount < Math.max(available - committed, 0) * 0.15) status = "tight";
  else status = "healthy";

  return {
    amount,
    rawAmount,
    available,
    committed,
    lines,
    nextIncomeDate: incomeDate,
    periodEnd,
    daysLeft,
    perDay: Math.floor(amount / daysLeft),
    status,
    spendableAccountIds: [...spendableIds],
  };
}

function sumItems(items: readonly SafeToSpendItem[]): Minor {
  return items.reduce((t, i) => t + i.amount, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
