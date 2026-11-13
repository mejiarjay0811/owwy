import { getDB } from "@/lib/storage/db";
import { payBill } from "@/lib/storage/repositories/bills";
import { addTransaction } from "@/lib/storage/repositories/transactions";
import type { Bill, ID, StagedTransaction } from "@/types/models";

export function isDraftComplete(d: StagedTransaction): boolean {
  if (!d.amount || !d.accountId) return false;
  return d.type === "transfer" ? Boolean(d.toAccountId && d.toAccountId !== d.accountId) : Boolean(d.categoryId);
}

/**
 * Saves staged transactions from Ask Owwy. Bill payments go through `payBill`
 * so the bill advances too. If anything fails, everything saved so far is
 * rolled back — nothing is ever half-logged.
 */
export async function saveStagedDrafts(drafts: readonly StagedTransaction[]): Promise<{ savedIds: ID[]; previousBills: Bill[] }> {
  const savedIds: ID[] = [];
  const previousBills: Bill[] = [];
  try {
    for (const d of drafts) {
      if (!isDraftComplete(d)) throw new Error("Some details are missing. Tap the entry to finish it.");
      const bill = d.billId && d.type === "expense" ? await getDB().bills.get(d.billId) : undefined;
      if (bill?.active) {
        const result = await payBill(bill.id, { accountId: d.accountId!, amount: d.amount, date: d.date });
        savedIds.push(result.transaction.id);
        previousBills.push(result.previous);
      } else {
        const tx = await addTransaction({ type: d.type, amount: d.amount, accountId: d.accountId!, toAccountId: d.toAccountId, categoryId: d.categoryId, date: d.date, note: d.note, tags: d.tags });
        savedIds.push(tx.id);
      }
    }
    return { savedIds, previousBills };
  } catch (error) {
    await undoStagedSave(savedIds, previousBills);
    throw error;
  }
}

/** Removes what `saveStagedDrafts` added and puts paid bills back how they were. */
export async function undoStagedSave(savedIds: readonly ID[], previousBills: readonly Bill[]): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.transactions, db.bills, async () => {
    await db.transactions.bulkDelete([...savedIds]);
    if (previousBills.length) await db.bills.bulkPut([...previousBills]);
  });
}
