import { ACCOUNT_TYPES } from "@/lib/defaults/card-styles";
import type { Account, ID, Minor, Transaction } from "@/types/models";

/**
 * Derives every account balance from opening balances and transactions.
 * Expenses leave `accountId`, income arrives in `accountId`,
 * transfers move from `accountId` to `toAccountId`.
 */
export function computeBalances(accounts: readonly Account[], transactions: readonly Transaction[]): Map<ID, Minor> {
  const balances = new Map<ID, Minor>();
  for (const account of accounts) balances.set(account.id, account.openingBalance);

  for (const tx of transactions) {
    switch (tx.type) {
      case "expense":
        adjust(balances, tx.accountId, -tx.amount);
        break;
      case "income":
        adjust(balances, tx.accountId, tx.amount);
        break;
      case "transfer":
        adjust(balances, tx.accountId, -tx.amount);
        // Cross-currency transfers record what actually arrived.
        if (tx.toAccountId) adjust(balances, tx.toAccountId, tx.toAmount ?? tx.amount);
        break;
    }
  }
  return balances;
}

function adjust(map: Map<ID, Minor>, id: ID, delta: Minor): void {
  // Transactions pointing at a deleted account are ignored rather than resurrecting it.
  const current = map.get(id);
  if (current === undefined) return;
  map.set(id, current + delta);
}

export function isLiability(account: Pick<Account, "type">): boolean {
  return ACCOUNT_TYPES[account.type].liability;
}

export function isSavingsAccount(account: Pick<Account, "type">): boolean {
  return ACCOUNT_TYPES[account.type].savings;
}

export interface BalanceTotals {
  /** Cash-like money you hold (excludes credit card debt). */
  totalBalance: Minor;
  /** Money in accounts marked as spendable. */
  spendable: Minor;
  /** Money in savings, emergency and investment accounts. */
  savings: Minor;
  /** Amount owed on credit accounts (positive number). */
  owed: Minor;
}

/** Totals in the main currency — pass balances already converted with `toBaseBalances` for foreign accounts. */
export function computeTotals(accounts: readonly Account[], balances: Map<ID, Minor>): BalanceTotals {
  const totals: BalanceTotals = { totalBalance: 0, spendable: 0, savings: 0, owed: 0 };
  for (const account of accounts) {
    if (account.archived) continue;
    const balance = balances.get(account.id) ?? 0;
    if (isLiability(account)) {
      totals.owed += Math.max(0, -balance);
      continue;
    }
    totals.totalBalance += balance;
    if (account.includeInSafeToSpend) totals.spendable += balance;
    if (isSavingsAccount(account)) totals.savings += balance;
  }
  return totals;
}
