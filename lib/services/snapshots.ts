import { addMonthKey, monthKey } from "@/lib/dates";
import { summarizeMonth } from "@/lib/finance/summary";
import type { ISODate, MonthKey } from "@/types/models";
import { getDB } from "@/lib/storage/db";

/**
 * When a new month starts, Owwy generates last month's review snapshot so the
 * dashboard can announce "Your August review is ready". Figures in the review
 * are always recomputed live; the snapshot tracks whether it has been seen.
 */
export async function ensureMonthlySnapshots(today: ISODate): Promise<MonthKey | null> {
  const db = getDB();
  const previous = addMonthKey(monthKey(today), -1);
  return db.transaction("rw", [db.snapshots, db.transactions, db.accounts, db.goals], async () => {
    if (await db.snapshots.get(previous)) return null;
    const transactions = await db.transactions.where("date").between(`${previous}-01`, `${previous}-31`, true, true).toArray();
    if (!transactions.length) return null;
    const summary = summarizeMonth(transactions, await db.accounts.toArray(), await db.goals.toArray(), previous);
    await db.snapshots.put({
      id: previous,
      generatedAt: Date.now(),
      seen: false,
      income: summary.income,
      spent: summary.spent,
      saved: summary.saved,
    });
    return previous;
  });
}

export async function markReviewSeen(month: MonthKey): Promise<void> {
  await getDB().snapshots.update(month, { seen: true });
}
