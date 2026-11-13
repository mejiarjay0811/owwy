import { FALLBACK_EXPENSE_CATEGORY_ID, FALLBACK_INCOME_CATEGORY_ID } from "@/lib/defaults/categories";
import { collectedFor } from "@/lib/finance/receivables";
import { createId } from "@/lib/utils/id";
import type { ID, ISODate, Minor, Receivable, Transaction } from "@/types/models";
import { getDB } from "../db";
import { receivableSchema, validate } from "../schemas";
import { buildTransaction } from "./transactions";

export interface ReceivableInput {
  person: string;
  note?: string;
  amount: Minor;
  dueDate?: ISODate;
  /** Already paid back before tracking in Owwy. */
  alreadyCollected?: Minor;
  /** Record the money leaving this account now (e.g. you just lent it). */
  lentFromAccountId?: ID;
  date: ISODate;
}

/**
 * Tracks money someone owes you. When you lend from an account, the outflow is
 * recorded against that account but never counted as spending.
 */
export async function createReceivable(input: ReceivableInput): Promise<Receivable> {
  const db = getDB();
  const now = Date.now();
  const receivable = validate(receivableSchema, {
    id: createId("rcv"),
    person: input.person.trim(),
    note: (input.note ?? "").trim(),
    originalAmount: input.amount,
    startingCollected: Math.min(input.amount, Math.max(0, input.alreadyCollected ?? 0)),
    dueDate: input.dueDate || undefined,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.transaction("rw", db.receivables, db.transactions, db.accounts, db.categories, async () => {
    await db.receivables.add(receivable);
    if (input.lentFromAccountId) {
      if (!(await db.accounts.get(input.lentFromAccountId))) throw new Error("Choose the account the money came from.");
      await db.transactions.add(
        buildTransaction({
          type: "expense",
          amount: input.amount,
          accountId: input.lentFromAccountId,
          categoryId: FALLBACK_EXPENSE_CATEGORY_ID,
          date: input.date,
          note: `Lent to ${receivable.person}`,
          receivableId: receivable.id,
        }),
      );
    }
  });
  return receivable;
}

export async function updateReceivable(id: ID, patch: Partial<Pick<Receivable, "person" | "note" | "originalAmount" | "dueDate" | "archived" | "closedAt">>): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.receivables, async () => {
    const current = await db.receivables.get(id);
    if (!current) throw new Error("This entry no longer exists.");
    const next = validate(receivableSchema, { ...current, ...patch, dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate || undefined, updatedAt: Date.now() });
    await db.receivables.put(next);
  });
}

export interface CollectionInput {
  receivableId: ID;
  accountId: ID;
  amount: Minor;
  date: ISODate;
}

/** Records money coming back. Collected money lands in the account but isn't income. */
export async function recordCollection(input: CollectionInput): Promise<{ transaction: Transaction; fullyCollected: boolean }> {
  const db = getDB();
  return db.transaction("rw", db.receivables, db.transactions, db.accounts, db.categories, async () => {
    const receivable = await db.receivables.get(input.receivableId);
    if (!receivable) throw new Error("This entry no longer exists.");
    if (!(await db.accounts.get(input.accountId))) throw new Error("Choose where the money arrived.");
    const history = await db.transactions.where("receivableId").equals(receivable.id).toArray();
    const remaining = Math.max(0, receivable.originalAmount - collectedFor(receivable, history));
    if (input.amount > remaining) throw new Error("That's more than what's still owed.");
    const transaction = buildTransaction({
      type: "income",
      amount: input.amount,
      accountId: input.accountId,
      categoryId: FALLBACK_INCOME_CATEGORY_ID,
      date: input.date,
      note: `${receivable.person} paid back`,
      receivableId: receivable.id,
    });
    await db.transactions.add(transaction);
    const fullyCollected = input.amount === remaining;
    if (fullyCollected) await db.receivables.update(receivable.id, { closedAt: Date.now(), updatedAt: Date.now() });
    return { transaction, fullyCollected };
  });
}

/** Removes the entry; linked transactions stay in history as ordinary entries. */
export async function deleteReceivable(id: ID): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.receivables, db.transactions, async () => {
    await db.transactions.where("receivableId").equals(id).modify({ receivableId: undefined });
    await db.receivables.delete(id);
  });
}
