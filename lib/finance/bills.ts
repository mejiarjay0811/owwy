import { diffDays, monthKey, nextOccurrence, occurrencesBetween } from "@/lib/dates";
import type { Bill, ISODate, Minor } from "@/types/models";

export type BillStatus = "overdue" | "dueSoon" | "paid" | "upcoming" | "inactive";

export interface BillOccurrence {
  bill: Bill;
  date: ISODate;
  amount: Minor;
  /** True for the bill's next unpaid due date (can be paid now). */
  isNext: boolean;
}

export const DUE_SOON_DAYS = 3;

export function billStatus(bill: Bill, today: ISODate): BillStatus {
  if (!bill.active) return "inactive";
  const days = diffDays(today, bill.nextDueDate);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "dueSoon";
  if (bill.lastPaidDate && monthKey(bill.lastPaidDate) === monthKey(today)) return "paid";
  return "upcoming";
}

/** Unpaid bill occurrences between `from` and `to`, including overdue ones before `from`. */
export function billOccurrences(
  bills: readonly Bill[],
  from: ISODate,
  to: ISODate,
  includeOverdue = true,
): BillOccurrence[] {
  const result: BillOccurrence[] = [];
  for (const bill of bills) {
    if (!bill.active) continue;
    const start = includeOverdue && bill.nextDueDate < from ? bill.nextDueDate : from;
    const dates = occurrencesBetween(bill.nextDueDate, bill.frequency, start, to, bill.anchorDay);
    dates.forEach((date, index) =>
      result.push({ bill, date, amount: bill.amount, isNext: index === 0 && date === bill.nextDueDate }),
    );
  }
  return result.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.bill.name.localeCompare(b.bill.name)));
}

/** New bill state after paying the current due date. One-time bills become inactive. */
export function advanceBillAfterPayment(bill: Bill, paidOn: ISODate): Pick<Bill, "nextDueDate" | "lastPaidDate" | "active"> {
  const next = nextOccurrence(bill.nextDueDate, bill.frequency, bill.anchorDay);
  return {
    nextDueDate: next ?? bill.nextDueDate,
    lastPaidDate: paidOn,
    active: next !== null,
  };
}

/**
 * Monthly-equivalent cost, for "your bills cost ₱X / month". A `monthDays`
 * schedule costs its amount once per chosen day, so a ₱500 rule on the 15th
 * and 30th is ₱1,000 a month.
 */
export function monthlyEquivalent(amount: Minor, frequency: Bill["frequency"], monthDays?: readonly number[]): Minor {
  switch (frequency) {
    case "monthDays":
      return amount * Math.max(1, new Set(monthDays ?? []).size);
    case "daily":
      return Math.round((amount * 365) / 12);
    case "weekly":
      return Math.round((amount * 52) / 12);
    case "biweekly":
      return Math.round((amount * 26) / 12);
    case "monthly":
      return amount;
    case "quarterly":
      return Math.round(amount / 3);
    case "yearly":
      return Math.round(amount / 12);
    case "once":
      return 0;
  }
}
