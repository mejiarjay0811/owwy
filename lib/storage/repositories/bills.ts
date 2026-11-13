import { parseISODate } from "@/lib/dates";
import { advanceBillAfterPayment } from "@/lib/finance/bills";
import { createId } from "@/lib/utils/id";
import type { Bill, Frequency, ID, ISODate, Minor, Transaction } from "@/types/models";
import { getDB } from "../db";
import { billSchema, validate } from "../schemas";
import { buildTransaction } from "./transactions";

export interface BillInput {
  name: string;
  emoji: string;
  amount: Minor;
  categoryId: ID;
  accountId?: ID;
  frequency: Frequency;
  nextDueDate: ISODate;
  remindDaysBefore?: number;
}

export async function createBill(input: BillInput): Promise<Bill> {
  const now = Date.now();
  const bill = validate(billSchema, {
    id: createId("bill"),
    ...input,
    name: input.name.trim(),
    accountId: input.accountId || undefined,
    anchorDay: parseISODate(input.nextDueDate).d,
    remindDaysBefore: input.remindDaysBefore ?? 2,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  await getDB().bills.add(bill);
  return bill;
}

export async function updateBill(id: ID, patch: Partial<BillInput> & { active?: boolean }): Promise<Bill> {
  const db = getDB();
  return db.transaction("rw", db.bills, async () => {
    const current = await db.bills.get(id);
    if (!current) throw new Error("This bill no longer exists.");
    const next = validate(billSchema, {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      accountId: patch.accountId === undefined ? current.accountId : patch.accountId || undefined,
      anchorDay: patch.nextDueDate ? parseISODate(patch.nextDueDate).d : current.anchorDay,
      updatedAt: Date.now(),
    });
    await db.bills.put(next);
    return next;
  });
}

export async function deleteBill(id: ID): Promise<Bill | undefined> {
  const db = getDB();
  return db.transaction("rw", db.bills, db.transactions, async () => {
    const bill = await db.bills.get(id);
    if (!bill) return undefined;
    // Past payments stay in history as regular expenses.
    await db.transactions.where("billId").equals(id).modify({ billId: undefined });
    await db.bills.delete(id);
    return bill;
  });
}

export interface PayBillInput {
  accountId: ID;
  amount?: Minor;
  date: ISODate;
}

export interface PayBillResult {
  transaction: Transaction;
  previous: Bill;
  updated: Bill;
}

/**
 * Paying a bill records the expense against the chosen account and moves the
 * bill to its next due date — atomically, so balances and bill state always agree.
 */
export async function payBill(id: ID, input: PayBillInput): Promise<PayBillResult> {
  const db = getDB();
  return db.transaction("rw", db.bills, db.transactions, db.accounts, async () => {
    const bill = await db.bills.get(id);
    if (!bill) throw new Error("This bill no longer exists.");
    if (!(await db.accounts.get(input.accountId))) throw new Error("Choose the account you paid from.");
    const transaction = buildTransaction({
      type: "expense",
      amount: input.amount ?? bill.amount,
      accountId: input.accountId,
      categoryId: bill.categoryId,
      date: input.date,
      note: bill.name,
      billId: bill.id,
    });
    const updated: Bill = { ...bill, ...advanceBillAfterPayment(bill, input.date), updatedAt: Date.now() };
    await db.transactions.add(transaction);
    await db.bills.put(updated);
    return { transaction, previous: bill, updated };
  });
}

/** Skips the current occurrence without recording a payment. */
export async function skipBill(id: ID, today: ISODate): Promise<{ previous: Bill; updated: Bill }> {
  const db = getDB();
  return db.transaction("rw", db.bills, async () => {
    const bill = await db.bills.get(id);
    if (!bill) throw new Error("This bill no longer exists.");
    const advanced = advanceBillAfterPayment(bill, today);
    const updated: Bill = { ...bill, nextDueDate: advanced.nextDueDate, active: advanced.active, updatedAt: Date.now() };
    await db.bills.put(updated);
    return { previous: bill, updated };
  });
}

/** Reverses `payBill`: removes the payment and restores the bill's previous state. */
export async function undoBillPayment(result: Pick<PayBillResult, "transaction" | "previous">): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.bills, db.transactions, async () => {
    await db.transactions.delete(result.transaction.id);
    await db.bills.put(result.previous);
  });
}

export async function restoreBill(bill: Bill): Promise<void> {
  await getDB().bills.put(bill);
}
