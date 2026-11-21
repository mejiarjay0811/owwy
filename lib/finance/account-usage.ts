import type { ID, OwwyDataset } from "@/types/models";

/**
 * Everything that would go, or be cut loose, if an account were deleted.
 *
 * There is one of these rather than two because there used to be two: the
 * sheet decided whether to offer Delete by counting the transactions it had
 * already loaded, while the repository refused based on transactions *plus*
 * goals, bills and automations. They disagreed in both directions — a bank
 * account with history got no Delete button at all, and an account with no
 * transactions but a goal attached got a button that always failed with
 * "archive it instead", which is no use when it is already archived.
 */
export interface AccountUsage {
  /** Deleted with the account: a transaction cannot exist without one. */
  transactions: number;
  /** Deleted with the account: a goal is saved *into* an account. */
  goals: number;
  /** Deleted with the account: a rule needs somewhere to post. */
  recurring: number;
  /** Kept, with the account detached — a bill is still a bill. */
  bills: number;
  /** Kept, with the account detached. */
  debts: number;
}

export const EMPTY_USAGE: AccountUsage = { transactions: 0, goals: 0, recurring: 0, bills: 0, debts: 0 };

export function accountUsageIn(data: Pick<OwwyDataset, "transactions" | "goals" | "bills" | "recurring" | "debts">, id: ID): AccountUsage {
  return {
    transactions: data.transactions.filter((t) => t.accountId === id || t.toAccountId === id).length,
    goals: data.goals.filter((g) => g.accountId === id).length,
    // A rule that only *pays into* this account keeps working from its own
    // account, so it is detached rather than deleted.
    recurring: data.recurring.filter((r) => r.accountId === id).length,
    bills: data.bills.filter((b) => b.accountId === id).length,
    debts: data.debts.filter((d) => d.accountId === id).length,
  };
}

export function hasHistory(usage: AccountUsage): boolean {
  return usage.transactions > 0 || usage.goals > 0 || usage.recurring > 0;
}

/** "60 transactions, 2 goals and 2 automations" — only the parts that apply. */
export function describeUsage(usage: AccountUsage): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many = `${one}s`) => n > 0 && parts.push(`${n} ${n === 1 ? one : many}`);
  add(usage.transactions, "transaction");
  add(usage.goals, "savings goal");
  add(usage.recurring, "automation");
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** What survives, detached: "1 bill" / "1 bill and 1 debt". */
export function describeDetached(usage: AccountUsage): string {
  const parts: string[] = [];
  if (usage.bills > 0) parts.push(`${usage.bills} ${usage.bills === 1 ? "bill" : "bills"}`);
  if (usage.debts > 0) parts.push(`${usage.debts} ${usage.debts === 1 ? "debt" : "debts"}`);
  return parts.join(" and ");
}
