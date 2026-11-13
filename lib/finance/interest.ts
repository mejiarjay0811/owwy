import { addMonthKey, monthEnd, monthKey, today as getToday } from "@/lib/dates";
import type { Account, Minor, MonthKey, Transaction } from "@/types/models";

export interface InterestPosting {
  month: MonthKey;
  /** Posted on the last day of the month, like most banks. */
  date: string;
  balance: Minor;
  gross: Minor;
  tax: Minor;
  net: Minor;
}

/** Default withholding tax for a currency (Philippine banks withhold 20% final tax). */
export function defaultInterestTax(currency: string): number {
  return currency === "PHP" ? 20 : 0;
}

/** Monthly after-tax interest on a balance. Negative or zero balances earn nothing. */
export function monthlyInterest(balance: Minor, annualRate: number, taxRate: number): { gross: Minor; tax: Minor; net: Minor } {
  if (balance <= 0 || annualRate <= 0) return { gross: 0, tax: 0, net: 0 };
  const gross = Math.round((balance * annualRate) / 100 / 12);
  const tax = Math.round((gross * Math.max(0, Math.min(100, taxRate))) / 100);
  return { gross, tax, net: gross - tax };
}

/**
 * Interest to post for every completed month since the last posting.
 * Compounds: each month's interest is added before computing the next.
 */
export function planInterest(account: Account, transactions: readonly Transaction[], today: string = getToday(), maxMonths = 24): InterestPosting[] {
  const rate = account.interestRate ?? 0;
  if (rate <= 0 || account.archived) return [];

  const lastComplete = addMonthKey(monthKey(today), -1);
  const firstMonth = account.interestPostedThrough ? addMonthKey(account.interestPostedThrough, 1) : monthKey(localDate(account.createdAt));
  if (firstMonth > lastComplete) return [];

  const relevant = transactions
    .filter((t) => t.accountId === account.id || t.toAccountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const postings: InterestPosting[] = [];
  let planned = 0;
  for (let month = firstMonth, i = 0; month <= lastComplete && i < maxMonths; month = addMonthKey(month, 1), i++) {
    const end = monthEnd(month);
    let balance = account.openingBalance + planned;
    for (const t of relevant) {
      if (t.date > end) break;
      if (t.type === "income" && t.accountId === account.id) balance += t.amount;
      else if (t.type === "expense" && t.accountId === account.id) balance -= t.amount;
      else if (t.type === "transfer") {
        if (t.accountId === account.id) balance -= t.amount;
        if (t.toAccountId === account.id) balance += t.amount;
      }
    }
    const { gross, tax, net } = monthlyInterest(balance, rate, account.interestTaxRate ?? 0);
    postings.push({ month, date: end, balance, gross, tax, net });
    planned += net;
  }
  // Months that earned nothing are still returned so the caller can advance `interestPostedThrough`.
  return postings;
}

function localDate(timestamp: number): string {
  return getToday(new Date(timestamp));
}
