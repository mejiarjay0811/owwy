import type { ISODate, Minor, Receivable, Transaction } from "@/types/models";
import { diffDays } from "@/lib/dates";

export type ReceivableStatus = "open" | "overdue" | "collected" | "closed";

export interface ReceivableProgress {
  receivable: Receivable;
  collected: Minor;
  remaining: Minor;
  percent: number;
  status: ReceivableStatus;
  daysUntilDue: number | null;
}

/** Money collected back through transactions linked to the receivable (income side). */
export function collectedFor(receivable: Receivable, transactions: readonly Transaction[]): Minor {
  let total = receivable.startingCollected;
  for (const tx of transactions) {
    if (tx.receivableId === receivable.id && tx.type === "income") total += tx.amount;
  }
  return total;
}

export function computeReceivableProgress(receivable: Receivable, transactions: readonly Transaction[], today: ISODate): ReceivableProgress {
  const collected = collectedFor(receivable, transactions);
  const remaining = Math.max(0, receivable.originalAmount - collected);
  const daysUntilDue = receivable.dueDate ? diffDays(today, receivable.dueDate) : null;
  let status: ReceivableStatus = "open";
  if (remaining === 0) status = "collected";
  else if (receivable.closedAt) status = "closed";
  else if (daysUntilDue !== null && daysUntilDue < 0) status = "overdue";
  return {
    receivable,
    collected,
    remaining,
    percent: receivable.originalAmount > 0 ? Math.min(100, (collected / receivable.originalAmount) * 100) : 100,
    status,
    daysUntilDue,
  };
}

export function totalStillToCollect(progress: readonly ReceivableProgress[]): Minor {
  return progress.filter((p) => p.status === "open" || p.status === "overdue").reduce((t, p) => t + p.remaining, 0);
}
