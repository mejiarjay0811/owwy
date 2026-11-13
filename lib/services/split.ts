import { getDB } from "@/lib/storage/db";
import { receivableSchema, validate } from "@/lib/storage/schemas";
import { buildTransaction } from "@/lib/storage/repositories/transactions";
import { createId } from "@/lib/utils/id";
import type { ID, ISODate, Minor } from "@/types/models";

export interface SplitBillInput {
  /** What the bill was for — becomes the note on every entry it creates. */
  description: string;
  date: ISODate;
  /** The account the whole bill was paid from. */
  accountId: ID;
  categoryId: ID;
  /** Your own share, logged as spending. */
  yourShare: Minor;
  /** Everyone else; each becomes an "Owed to you" entry. */
  others: { person: string; amount: Minor }[];
  dueDate?: ISODate;
}

export interface SplitBillResult {
  transactionIds: ID[];
  receivableIds: ID[];
  owed: Minor;
  total: Minor;
}

/**
 * Splits a bill you paid for the whole table.
 *
 * The account loses the full amount, because that is what actually left it,
 * but only your share counts as spending — everyone else's share becomes money
 * owed to you, which Owwy already tracks and counts in your net worth.
 * All of it is written in one transaction, so a split is never half-saved.
 */
export async function saveSplitBill(input: SplitBillInput): Promise<SplitBillResult> {
  const db = getDB();
  const description = input.description.trim() || "Split bill";
  const others = input.others.filter((o) => o.person.trim() && o.amount > 0);
  if (!others.length) throw new Error("Add at least one person to split with.");
  if (input.yourShare < 0) throw new Error("Their shares add up to more than the total.");

  return db.transaction("rw", db.transactions, db.receivables, db.accounts, db.categories, async () => {
    if (!(await db.accounts.get(input.accountId))) throw new Error("Choose the account you paid from.");

    const now = Date.now();
    const transactionIds: ID[] = [];
    const receivableIds: ID[] = [];

    if (input.yourShare > 0) {
      const yours = buildTransaction(
        { type: "expense", amount: input.yourShare, accountId: input.accountId, categoryId: input.categoryId, date: input.date, note: description },
        now,
      );
      await db.transactions.add(yours);
      transactionIds.push(yours.id);
    }

    for (const [index, other] of others.entries()) {
      const person = other.person.trim();
      const receivable = validate(receivableSchema, {
        id: createId("rcv"),
        person,
        note: description,
        originalAmount: other.amount,
        startingCollected: 0,
        dueDate: input.dueDate || undefined,
        archived: false,
        createdAt: now + index,
        updatedAt: now + index,
      });
      await db.receivables.add(receivable);
      receivableIds.push(receivable.id);

      // Their share left the account too, but it is lending, not spending.
      const lent = buildTransaction(
        {
          type: "expense",
          amount: other.amount,
          accountId: input.accountId,
          categoryId: input.categoryId,
          date: input.date,
          note: `${description} · ${person}'s share`,
          receivableId: receivable.id,
        },
        now + index + 1,
      );
      await db.transactions.add(lent);
      transactionIds.push(lent.id);
    }

    const owed = others.reduce((sum, o) => sum + o.amount, 0);
    return { transactionIds, receivableIds, owed, total: owed + input.yourShare };
  });
}

/** Removes everything a split created, for the Undo action. */
export async function undoSplitBill(result: SplitBillResult): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.transactions, db.receivables, async () => {
    await db.transactions.bulkDelete(result.transactionIds);
    await db.receivables.bulkDelete(result.receivableIds);
  });
}
