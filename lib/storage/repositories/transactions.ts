import { createId } from "@/lib/utils/id";
import type { ID, ISODate, Minor, Transaction, TransactionType } from "@/types/models";
import { getDB } from "../db";
import { transactionSchema, validate } from "../schemas";

export interface TransactionInput {
  type: TransactionType;
  amount: Minor;
  accountId: ID;
  toAccountId?: ID;
  /** Destination amount when the two accounts use different currencies. */
  toAmount?: Minor;
  receivableId?: ID;
  categoryId?: ID;
  date: ISODate;
  time?: string;
  note?: string;
  tags?: string[];
  billId?: ID;
  goalId?: ID;
  debtId?: ID;
  recurringId?: ID;
}

export function buildTransaction(input: TransactionInput, now = Date.now()): Transaction {
  return validate(transactionSchema, {
    id: createId("tx"),
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    toAccountId: input.type === "transfer" ? input.toAccountId : undefined,
    toAmount: input.type === "transfer" && input.toAmount ? input.toAmount : undefined,
    receivableId: input.receivableId,
    categoryId: input.type === "transfer" ? undefined : input.categoryId,
    date: input.date,
    time: input.time || undefined,
    note: (input.note ?? "").trim(),
    tags: [...new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
    billId: input.billId,
    goalId: input.goalId,
    debtId: input.debtId,
    recurringId: input.recurringId,
    createdAt: now,
    updatedAt: now,
  }) as Transaction;
}

async function assertReferences(input: Pick<TransactionInput, "type" | "accountId" | "toAccountId" | "categoryId">) {
  const db = getDB();
  const account = await db.accounts.get(input.accountId);
  if (!account) throw new Error("Choose an account for this transaction.");
  if (input.type === "transfer") {
    const to = input.toAccountId ? await db.accounts.get(input.toAccountId) : undefined;
    if (!to) throw new Error("Choose where the money is going.");
    return;
  }
  if (!input.categoryId) throw new Error("Choose a category.");
  const category = await db.categories.get(input.categoryId);
  if (!category) throw new Error("That category no longer exists.");
  if (category.kind !== input.type) {
    throw new Error(input.type === "income" ? "Pick an income category." : "Pick an expense category.");
  }
}

export async function addTransaction(input: TransactionInput): Promise<Transaction> {
  const db = getDB();
  const tx = buildTransaction(input);
  await db.transaction("rw", db.transactions, db.accounts, db.categories, async () => {
    await assertReferences(tx);
    await db.transactions.add(tx);
  });
  return tx;
}

export async function updateTransaction(id: ID, patch: Partial<TransactionInput>): Promise<Transaction> {
  const db = getDB();
  return db.transaction("rw", db.transactions, db.accounts, db.categories, async () => {
    const current = await db.transactions.get(id);
    if (!current) throw new Error("This transaction no longer exists.");
    const type = patch.type ?? current.type;
    const next = validate(transactionSchema, {
      ...current,
      ...patch,
      toAccountId: type === "transfer" ? (patch.toAccountId ?? current.toAccountId) : undefined,
      toAmount: type === "transfer" ? ("toAmount" in patch ? patch.toAmount || undefined : current.toAmount) : undefined,
      categoryId: type === "transfer" ? undefined : (patch.categoryId ?? current.categoryId),
      note: (patch.note ?? current.note).trim(),
      updatedAt: Date.now(),
    }) as Transaction;
    await assertReferences(next);
    await db.transactions.put(next);
    return next;
  });
}

/** Deletes and returns the transaction so the caller can offer Undo. */
export async function deleteTransaction(id: ID): Promise<Transaction | undefined> {
  const db = getDB();
  return db.transaction("rw", db.transactions, async () => {
    const tx = await db.transactions.get(id);
    if (tx) await db.transactions.delete(id);
    return tx;
  });
}

export async function restoreTransactions(transactions: Transaction[]): Promise<void> {
  if (!transactions.length) return;
  await getDB().transactions.bulkPut(transactions);
}
