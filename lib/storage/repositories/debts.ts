import { addMonths, monthKey, parseISODate } from "@/lib/dates";
import { DEBT_CATEGORY_ID } from "@/lib/defaults/categories";
import { debtPayments } from "@/lib/finance/debts";
import { createId } from "@/lib/utils/id";
import type { Debt, DebtKind, ID, ISODate, Minor, Transaction } from "@/types/models";
import { getDB } from "../db";
import { debtSchema, validate } from "../schemas";
import { buildTransaction } from "./transactions";

export interface DebtInput {
  name: string;
  kind: DebtKind;
  startingBalance: Minor;
  originalAmount?: Minor;
  minimumPayment: Minor;
  nextDueDate?: ISODate;
  interestRate?: number;
  accountId?: ID;
  lender?: string;
  /** Installment plans: term length and when the first payment was due. */
  termMonths?: number;
  startedOn?: ISODate;
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const now = Date.now();
  const debt = validate(debtSchema, {
    id: createId("debt"),
    ...input,
    name: input.name.trim(),
    originalAmount: Math.max(input.originalAmount ?? 0, input.startingBalance),
    nextDueDate: input.nextDueDate || undefined,
    anchorDay: input.nextDueDate ? parseISODate(input.nextDueDate).d : undefined,
    accountId: input.accountId || undefined,
    lender: input.lender?.trim() || undefined,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  await getDB().debts.add(debt);
  return debt;
}

export async function updateDebt(id: ID, patch: Partial<DebtInput> & { archived?: boolean }): Promise<Debt> {
  const db = getDB();
  return db.transaction("rw", db.debts, async () => {
    const current = await db.debts.get(id);
    if (!current) throw new Error("This debt no longer exists.");
    const next = validate(debtSchema, {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      nextDueDate: patch.nextDueDate === undefined ? current.nextDueDate : patch.nextDueDate || undefined,
      anchorDay: patch.nextDueDate ? parseISODate(patch.nextDueDate).d : current.anchorDay,
      accountId: patch.accountId === undefined ? current.accountId : patch.accountId || undefined,
      updatedAt: Date.now(),
    });
    await db.debts.put(next);
    return next;
  });
}

export async function deleteDebt(id: ID): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.debts, db.transactions, async () => {
    await db.transactions.where("debtId").equals(id).modify({ debtId: undefined });
    await db.debts.delete(id);
  });
}

export interface DebtPaymentInput {
  debtId: ID;
  fromAccountId: ID;
  amount: Minor;
  date: ISODate;
}

/**
 * Records a debt payment. Credit cards tracked as accounts receive a transfer
 * (reducing what's owed); other debts record an expense in the Debt category.
 * Once this month's minimum is met, the next due date moves forward a month.
 */
export async function recordDebtPayment(input: DebtPaymentInput): Promise<Transaction> {
  const db = getDB();
  return db.transaction("rw", db.debts, db.transactions, db.accounts, db.categories, async () => {
    const debt = await db.debts.get(input.debtId);
    if (!debt) throw new Error("This debt no longer exists.");
    if (!(await db.accounts.get(input.fromAccountId))) throw new Error("Choose the account you paid from.");
    if (debt.accountId && debt.accountId === input.fromAccountId) throw new Error("Pay from a different account.");

    const linked = debt.accountId ? await db.accounts.get(debt.accountId) : undefined;
    const transaction = buildTransaction(
      linked
        ? { type: "transfer", amount: input.amount, accountId: input.fromAccountId, toAccountId: linked.id, date: input.date, note: `${debt.name} payment`, debtId: debt.id }
        : { type: "expense", amount: input.amount, accountId: input.fromAccountId, categoryId: DEBT_CATEGORY_ID, date: input.date, note: `${debt.name} payment`, debtId: debt.id },
    );
    await db.transactions.add(transaction);

    if (debt.nextDueDate && debt.minimumPayment > 0) {
      const dueMonth = monthKey(debt.nextDueDate);
      const history = await db.transactions.where("debtId").equals(debt.id).toArray();
      if (monthKey(input.date) >= dueMonth && debtPayments(debt, history, monthKey(input.date)) >= debt.minimumPayment) {
        await db.debts.update(debt.id, {
          nextDueDate: addMonths(debt.nextDueDate, 1, debt.anchorDay),
          updatedAt: Date.now(),
        });
      }
    }
    return transaction;
  });
}
