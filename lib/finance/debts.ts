import { addMonths, monthKey } from "@/lib/dates";
import type { Debt, ID, ISODate, Minor, Transaction } from "@/types/models";

export interface DebtProgress {
  debt: Debt;
  remaining: Minor;
  paid: Minor;
  /** Share of the original amount that has been paid off, 0–100. */
  percent: number;
  paidThisMonth: Minor;
  /** Months to pay off at the minimum payment (interest not modeled). */
  monthsToPayoff: number | null;
  payoffDate: ISODate | null;
  minimumMetThisMonth: boolean;
}

/**
 * Remaining balance: linked credit accounts use their live balance;
 * standalone debts subtract recorded payments from the starting balance.
 */
export function debtRemaining(debt: Debt, transactions: readonly Transaction[], balances: Map<ID, Minor>): Minor {
  if (debt.accountId && balances.has(debt.accountId)) {
    return Math.max(0, -(balances.get(debt.accountId) ?? 0));
  }
  return Math.max(0, debt.startingBalance - debtPayments(debt, transactions));
}

export function debtPayments(debt: Debt, transactions: readonly Transaction[], month?: string): Minor {
  let total = 0;
  for (const tx of transactions) {
    if (tx.debtId !== debt.id) continue;
    if (month && monthKey(tx.date) !== month) continue;
    total += tx.amount;
  }
  return total;
}

export function computeDebtProgress(
  debt: Debt,
  transactions: readonly Transaction[],
  balances: Map<ID, Minor>,
  today: ISODate,
): DebtProgress {
  const remaining = debtRemaining(debt, transactions, balances);
  const original = Math.max(debt.originalAmount, debt.startingBalance, remaining);
  const paid = Math.max(0, original - remaining);
  const paidThisMonth = debtPayments(debt, transactions, monthKey(today));
  const monthsToPayoff = remaining === 0 ? 0 : debt.minimumPayment > 0 ? Math.ceil(remaining / debt.minimumPayment) : null;

  return {
    debt,
    remaining,
    paid,
    percent: original > 0 ? (paid / original) * 100 : 100,
    paidThisMonth,
    monthsToPayoff,
    payoffDate: monthsToPayoff === null ? null : addMonths(today, monthsToPayoff),
    minimumMetThisMonth: debt.minimumPayment === 0 || paidThisMonth >= debt.minimumPayment,
  };
}
