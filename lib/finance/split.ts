import { splitEvenly } from "@/lib/money";
import type { Minor } from "@/types/models";

export interface SplitShare {
  /** Empty for your own share. */
  person: string;
  amount: Minor;
  isYou: boolean;
}

/**
 * Splits a bill between you and other people. Even splits spread the odd
 * centavos so the shares always add back up to the total.
 */
export function evenShares(total: Minor, names: readonly string[]): SplitShare[] {
  const parts = splitEvenly(Math.max(0, total), names.length + 1);
  return [{ person: "", amount: parts[0], isYou: true }, ...names.map((person, i) => ({ person, amount: parts[i + 1], isYou: false }))];
}

/** Your share is whatever the others don't cover. */
export function customShares(total: Minor, entries: readonly { person: string; amount: Minor }[]): SplitShare[] {
  const others = entries.map((e) => ({ person: e.person, amount: Math.max(0, e.amount), isYou: false }));
  const claimed = others.reduce((sum, o) => sum + o.amount, 0);
  return [{ person: "", amount: total - claimed, isYou: true }, ...others];
}

export interface SplitCheck {
  /** What the other people owe you in total. */
  owed: Minor;
  yours: Minor;
  /** True when the split can be saved. */
  valid: boolean;
  problem: string | null;
}

export function checkSplit(total: Minor, shares: readonly SplitShare[]): SplitCheck {
  const yours = shares.find((s) => s.isYou)?.amount ?? 0;
  const others = shares.filter((s) => !s.isYou);
  const owed = others.reduce((sum, s) => sum + s.amount, 0);
  const named = others.every((s) => s.person.trim().length > 0);

  let problem: string | null = null;
  if (total <= 0) problem = "Enter the total you paid.";
  else if (!others.length) problem = "Add at least one person to split with.";
  else if (!named) problem = "Give everyone a name.";
  else if (yours < 0) problem = "Their shares add up to more than the total.";
  else if (owed === 0) problem = "Nobody owes you anything in this split.";

  return { owed, yours, valid: problem === null, problem };
}
