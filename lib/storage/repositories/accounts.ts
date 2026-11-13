import { addMonthKey, monthKey, today } from "@/lib/dates";
import { ACCOUNT_TYPES } from "@/lib/defaults/card-styles";
import { createId } from "@/lib/utils/id";
import type { Account, AccountType, CardPattern, CurrencyCode, ID, Minor } from "@/types/models";
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
 * Deletes an account only when nothing depends on it. Accounts with history
 * should be archived so past transactions and reports stay accurate.
 */
export async function deleteAccount(id: ID): Promise<Account> {
  const db = getDB();
  const usage = await accountUsage(id);
  if (usage.transactions > 0 || usage.goals > 0 || usage.recurring > 0) {
    throw new Error("This account has history. Archive it instead so your past reports stay accurate.");
  }
  return db.transaction("rw", db.accounts, db.bills, db.debts, async () => {
    const account = await db.accounts.get(id);
    if (!account) throw new Error("This account no longer exists.");
    await db.bills.filter((b) => b.accountId === id).modify({ accountId: undefined });
    await db.debts.where("accountId").equals(id).modify({ accountId: undefined });
    await db.accounts.delete(id);
    return account;
  });
}

export async function restoreAccount(account: Account): Promise<void> {
  await getDB().accounts.put(account);
}
