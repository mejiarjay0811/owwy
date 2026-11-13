import type { Minor } from "@/types/models";
import type { SafeToSpendResult } from "./safe-to-spend";

export type AffordVerdict = "comfortable" | "think" | "notRecommended";

export interface AffordResult {
  verdict: AffordVerdict;
  price: Minor;
  safeBefore: Minor;
  safeAfter: Minor;
  perDayBefore: Minor;
  perDayAfter: Minor;
  daysLeft: number;
  /** Share of Safe-to-Spend the purchase would use, 0–∞. */
  shareOfSafe: number;
  headline: string;
  reasons: string[];
}

/** Purchases using less than this share of Safe-to-Spend are "comfortable". */
export const COMFORTABLE_SHARE = 0.7;

/**
 * A budgeting calculation on the user's own numbers — not financial advice.
 *
 * - comfortable: fits inside Safe-to-Spend with room left for daily spending
 * - think: fits but uses most of it, or dips into cushion/planned savings
 * - notRecommended: would leave too little for upcoming bills and debt payments
 */
export function evaluateAffordability(price: Minor, sts: SafeToSpendResult): AffordResult {
  const safeBefore = sts.amount;
  const safeAfter = sts.rawAmount - price;
  const perDayBefore = sts.perDay;
  const perDayAfter = Math.floor(Math.max(0, safeAfter) / sts.daysLeft);
  const shareOfSafe = safeBefore > 0 ? price / safeBefore : Infinity;
  const afterCommitments = sts.available - sts.committed - price;

  const reasons: string[] = [];
  let verdict: AffordVerdict;
  let headline: string;

  if (price <= 0) {
    verdict = "comfortable";
    headline = "Enter an amount to check.";
  } else if (afterCommitments < 0) {
    verdict = "notRecommended";
    headline = "This would put your upcoming bills at risk.";
    reasons.push("After this purchase, your spending accounts wouldn't cover the bills and payments due before your next income.");
  } else if (safeAfter < 0) {
    verdict = "think";
    headline = "This would dip into your savings plan or cushion.";
    reasons.push("Your bills stay covered, but you'd use money you planned to save or keep as a cushion.");
  } else if (shareOfSafe > COMFORTABLE_SHARE) {
    verdict = "think";
    headline = "You can, but it uses most of your spending money.";
    reasons.push(`It takes ${Math.round(shareOfSafe * 100)}% of what's safe to spend until your next income.`);
  } else {
    verdict = "comfortable";
    headline = "You can afford this purchase.";
    reasons.push("Your bills, savings plan and cushion all stay covered.");
  }

  return { verdict, price, safeBefore, safeAfter, perDayBefore, perDayAfter, daysLeft: sts.daysLeft, shareOfSafe, headline, reasons };
}
