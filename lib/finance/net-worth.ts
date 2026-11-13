import { ACCOUNT_TYPES } from "@/lib/defaults/card-styles";
import type { Account, ID, Minor } from "@/types/models";
import { isLiability } from "./balances";
import type { DebtProgress } from "./debts";
import type { ReceivableProgress } from "./receivables";

export interface NetWorthEntry {
  id: ID;
  label: string;
  emoji: string;
  amount: Minor;
}

export interface NetWorth {
  assets: NetWorthEntry[];
  liabilities: NetWorthEntry[];
  totalAssets: Minor;
  totalLiabilities: Minor;
  netWorth: Minor;
}

/**
 * What you own minus what you owe, in the main currency (pass converted balances).
 * Debts linked to credit accounts are counted once; money owed to you counts as an asset.
 */
export function computeNetWorth(
  accounts: readonly Account[],
  balances: Map<ID, Minor>,
  debtProgress: readonly DebtProgress[],
  receivables: readonly ReceivableProgress[] = [],
): NetWorth {
  const assets: NetWorthEntry[] = [];
  const liabilities: NetWorthEntry[] = [];

  for (const account of accounts) {
    if (account.archived) continue;
    const balance = balances.get(account.id) ?? 0;
    const emoji = ACCOUNT_TYPES[account.type].emoji;
    if (isLiability(account) || balance < 0) {
      if (balance < 0) liabilities.push({ id: account.id, label: account.name, emoji, amount: -balance });
    } else {
      assets.push({ id: account.id, label: account.name, emoji, amount: balance });
    }
  }

  const linkedAccounts = new Set(accounts.map((a) => a.id));
  for (const p of debtProgress) {
    if (p.debt.archived || p.remaining === 0) continue;
    if (p.debt.accountId && linkedAccounts.has(p.debt.accountId)) continue;
    liabilities.push({ id: p.debt.id, label: p.debt.name, emoji: "🧾", amount: p.remaining });
  }

  for (const r of receivables) {
    if (r.remaining === 0 || r.status === "closed" || r.receivable.archived) continue;
    assets.push({ id: r.receivable.id, label: `Owed by ${r.receivable.person}`, emoji: "🤝", amount: r.remaining });
  }

  const totalAssets = assets.reduce((t, e) => t + e.amount, 0);
  const totalLiabilities = liabilities.reduce((t, e) => t + e.amount, 0);
  return { assets, liabilities, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}
