import type { Account, CurrencyCode, ExchangeRates, ID, Minor, Transaction } from "@/types/models";
import { minorFactor } from "./currency";

/**
 * Offline currency conversion using the user's own exchange rates.
 * Rates are "units of the main currency per 1 unit of X" (e.g. USD: 56.5 for PHP).
 * Owwy never fetches rates: the user stays in control and the app works offline.
 */

export interface FxContext {
  base: CurrencyCode;
  rates: ExchangeRates;
}

/** Rough starting points so a new foreign account isn't blank; users should set today's rate. */
export const APPROXIMATE_RATES_PER_USD: Record<CurrencyCode, number> = {
  USD: 1,
  PHP: 56.5,
  EUR: 0.92,
  GBP: 0.78,
  SGD: 1.34,
  AUD: 1.52,
  CAD: 1.37,
  JPY: 147,
};

/** Approximate rate of `currency` expressed in `base`, from the built-in table. */
export function approximateRate(currency: CurrencyCode, base: CurrencyCode): number {
  return round6(APPROXIMATE_RATES_PER_USD[base] / APPROXIMATE_RATES_PER_USD[currency]);
}

/** Base units per 1 unit of `currency`. Missing rates fall back to the approximate table. */
export function rateToBase(currency: CurrencyCode, fx: FxContext): number {
  if (currency === fx.base) return 1;
  const rate = fx.rates[currency];
  return rate && rate > 0 ? rate : approximateRate(currency, fx.base);
}

/** Converts minor units between currencies (handles differing decimal places, e.g. JPY). */
export function convertMinor(minor: Minor, from: CurrencyCode, to: CurrencyCode, fx: FxContext): Minor {
  if (from === to) return minor;
  const major = minor / minorFactor(from);
  const inBase = major * rateToBase(from, fx);
  const target = to === fx.base ? inBase : inBase / rateToBase(to, fx);
  return Math.round(target * minorFactor(to));
}

export function toBase(minor: Minor, from: CurrencyCode, fx: FxContext): Minor {
  return convertMinor(minor, from, fx.base, fx);
}

export function accountCurrency(account: Pick<Account, "currency"> | undefined, fx: FxContext): CurrencyCode {
  return account?.currency ?? fx.base;
}

export function hasForeignAccounts(accounts: readonly Account[], fx: FxContext): boolean {
  return accounts.some((a) => a.currency && a.currency !== fx.base);
}

/**
 * Transactions with `amount` expressed in the main currency, for totals,
 * budgets, stats and Safe to Spend. Returns the same array when every account
 * already uses the main currency.
 */
export function toBaseTransactions(transactions: readonly Transaction[], accountsById: Map<ID, Account>, fx: FxContext): Transaction[] {
  const foreign = [...accountsById.values()].some((a) => a.currency && a.currency !== fx.base);
  if (!foreign) return transactions as Transaction[];
  return transactions.map((tx) => {
    const currency = accountCurrency(accountsById.get(tx.accountId), fx);
    if (currency === fx.base) return tx;
    return { ...tx, amount: toBase(tx.amount, currency, fx), toAmount: undefined };
  });
}

/** Account balances converted to the main currency. */
export function toBaseBalances(balances: Map<ID, Minor>, accountsById: Map<ID, Account>, fx: FxContext): Map<ID, Minor> {
  const result = new Map<ID, Minor>();
  for (const [id, balance] of balances) result.set(id, toBase(balance, accountCurrency(accountsById.get(id), fx), fx));
  return result;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
