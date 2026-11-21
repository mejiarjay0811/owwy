import { addMonthKey, monthKey, today } from "@/lib/dates";
import { ACCOUNT_TYPES } from "@/lib/defaults/card-styles";
import { createId } from "@/lib/utils/id";
import type { Account, AccountType, Bill, CardPattern, CurrencyCode, Debt, ID, Minor, RecurringTransaction, SavingsGoal, Transaction } from "@/types/models";
import { getDB } from "../db";
import { accountSchema, validate } from "../schemas";

export interface AccountInput {
  name: string;
  type: AccountType;
  openingBalance: Minor;
  cardStyle?: string;
  cardPattern?: CardPattern;
  last4?: string;
  creditLimit?: Minor;
  includeInSafeToSpend?: boolean;
  interestRate?: number;
  interestTaxRate?: number;
  /** Omit or pass the main currency for a regular account. */
  currency?: CurrencyCode;
  dueDay?: number;
}

/** Interest starts accruing from the current month; nothing is back-posted. */
function interestStart(): string {
  return addMonthKey(monthKey(today()), -1);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const db = getDB();
  const now = Date.now();
  const info = ACCOUNT_TYPES[input.type];
  const order = (await db.accounts.count()) + 1;
  const account = validate(accountSchema, {
    id: createId("acc"),
    name: input.name.trim(),
    type: input.type,
    // Credit cards are entered as "amount owed", stored as a negative balance.
    openingBalance: info.liability ? -Math.abs(input.openingBalance) : input.openingBalance,
    cardStyle: input.cardStyle ?? info.defaultStyle,
    cardPattern: input.cardPattern ?? "feathers",
    last4: input.last4 || undefined,
    creditLimit: info.liability ? input.creditLimit : undefined,
    includeInSafeToSpend: info.liability ? false : (input.includeInSafeToSpend ?? info.spendable),
    interestRate: !info.liability && input.interestRate ? input.interestRate : undefined,
    interestTaxRate: !info.liability && input.interestRate ? (input.interestTaxRate ?? 0) : undefined,
    interestPostedThrough: !info.liability && input.interestRate ? interestStart() : undefined,
    currency: input.currency,
    dueDay: info.liability ? input.dueDay : undefined,
    archived: false,
    order,
    createdAt: now,
    updatedAt: now,
  }) as Account;
  await db.accounts.add(account);
  return account;
}

export async function updateAccount(id: ID, patch: Partial<AccountInput>): Promise<Account> {
  const db = getDB();
  return db.transaction("rw", db.accounts, async () => {
    const current = await db.accounts.get(id);
    if (!current) throw new Error("This account no longer exists.");
    const type = patch.type ?? current.type;
    const info = ACCOUNT_TYPES[type];
    const next = validate(accountSchema, {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim(),
      openingBalance:
        patch.openingBalance === undefined
          ? current.openingBalance
          : info.liability
            ? -Math.abs(patch.openingBalance)
            : patch.openingBalance,
      last4: patch.last4 === undefined ? current.last4 : patch.last4 || undefined,
      includeInSafeToSpend: info.liability ? false : (patch.includeInSafeToSpend ?? current.includeInSafeToSpend),
      interestRate: info.liability ? undefined : patch.interestRate === undefined ? current.interestRate : patch.interestRate || undefined,
      interestTaxRate: info.liability ? undefined : (patch.interestTaxRate ?? current.interestTaxRate),
      // Turning interest on starts from now, so past months aren't back-filled.
      interestPostedThrough: !current.interestRate && patch.interestRate ? interestStart() : current.interestPostedThrough,
      currency: "currency" in patch ? patch.currency : current.currency,
      dueDay: info.liability ? ("dueDay" in patch ? patch.dueDay || undefined : current.dueDay) : undefined,
      updatedAt: Date.now(),
    }) as Account;
    await db.accounts.put(next);
    return next;
  });
}

export async function setAccountArchived(id: ID, archived: boolean): Promise<void> {
  await getDB().accounts.update(id, { archived, updatedAt: Date.now() });
}

export async function reorderAccounts(ids: ID[]): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.accounts, async () => {
    await Promise.all(ids.map((id, index) => db.accounts.update(id, { order: index + 1 })));
  });
}

export async function accountUsage(id: ID): Promise<{ transactions: number; goals: number; bills: number; recurring: number }> {
  const db = getDB();
  const [from, to, goals, bills, recurring] = await Promise.all([
    db.transactions.where("accountId").equals(id).count(),
    db.transactions.where("toAccountId").equals(id).count(),
    db.goals.where("accountId").equals(id).count(),
    db.bills.filter((b) => b.accountId === id).count(),
    db.recurring.filter((r) => r.accountId === id || r.toAccountId === id).count(),
  ]);
  return { transactions: from + to, goals, bills, recurring };
}

/**
 * Everything removed by a delete, kept so the whole thing can be undone.
 *
 * Deleting an account with history is a big action, and the only honest way
 * to offer it is to be able to take it back — so the rows are handed back
 * rather than dropped, and `restoreDeletedAccount` puts them all where they
 * were.
 */
export interface DeletedAccount {
  account: Account;
  transactions: Transaction[];
  goals: SavingsGoal[];
  recurring: RecurringTransaction[];
  /** Detached rather than deleted; kept so Undo can re-attach them. */
  bills: Bill[];
  debts: Debt[];
}

/**
 * Deletes an account.
 *
 * Archiving is still the right answer most of the time, and the sheet says
 * so — an archived account keeps every past report accurate. But it is the
 * user's data, and "you may never remove this" is not a position Owwy gets
 * to take, so a delete that takes the history with it is available once it
 * has been spelled out and confirmed.
 *
 * What goes: the account, its transactions (a transaction cannot exist
 * without one), goals saved into it, and automations that post from it.
 * What stays, detached: bills and debts, which are still real either way.
 * An automation that only pays *into* this account keeps working from its
 * own, so it is detached too.
 */
export async function deleteAccount(id: ID): Promise<DeletedAccount> {
  const db = getDB();
  return db.transaction("rw", [db.accounts, db.transactions, db.goals, db.recurring, db.bills, db.debts], async () => {
    const account = await db.accounts.get(id);
    if (!account) throw new Error("This account no longer exists.");

    const transactions = await db.transactions.filter((t) => t.accountId === id || t.toAccountId === id).toArray();
    const goals = await db.goals.filter((g) => g.accountId === id).toArray();
    const recurring = await db.recurring.filter((r) => r.accountId === id).toArray();
    const bills = await db.bills.filter((b) => b.accountId === id).toArray();
    const debts = await db.debts.filter((d) => d.accountId === id).toArray();

    await db.transactions.bulkDelete(transactions.map((t) => t.id));
    await db.goals.bulkDelete(goals.map((g) => g.id));
    await db.recurring.bulkDelete(recurring.map((r) => r.id));
    await db.bills.filter((b) => b.accountId === id).modify({ accountId: undefined });
    await db.debts.filter((d) => d.accountId === id).modify({ accountId: undefined });
    await db.recurring.filter((r) => r.toAccountId === id).modify({ toAccountId: undefined });
    await db.accounts.delete(id);

    return { account, transactions, goals, recurring, bills, debts };
  });
}

export async function restoreAccount(account: Account): Promise<void> {
  await getDB().accounts.put(account);
}

/** Puts back everything `deleteAccount` removed, including the detached links. */
export async function restoreDeletedAccount(deleted: DeletedAccount): Promise<void> {
  const db = getDB();
  await db.transaction("rw", [db.accounts, db.transactions, db.goals, db.recurring, db.bills, db.debts], async () => {
    await db.accounts.put(deleted.account);
    if (deleted.transactions.length) await db.transactions.bulkPut(deleted.transactions);
    if (deleted.goals.length) await db.goals.bulkPut(deleted.goals);
    if (deleted.recurring.length) await db.recurring.bulkPut(deleted.recurring);
    if (deleted.bills.length) await db.bills.bulkPut(deleted.bills);
    if (deleted.debts.length) await db.debts.bulkPut(deleted.debts);
  });
}
