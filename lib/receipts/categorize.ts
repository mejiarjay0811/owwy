import { scoreCategories } from "@/lib/finance/smart-input";
import { normalize } from "@/lib/finance/text";
import type { Category, ID, Transaction } from "@/types/models";
import type { ParsedReceipt } from "./parse-receipt";

export type GuessReason = "history" | "merchant" | "items";

export interface CategoryGuess {
  categoryId: ID | null;
  /** 0–1. Above 0.75 Owwy fills the category in; below that it asks. */
  confidence: number;
  reason: GuessReason | null;
  /** One line explaining the guess, in Owwy's voice. */
  detail: string | null;
  /** Other sensible categories, best first. */
  alternatives: ID[];
}

/** Words too generic to identify a shop on their own. */
const GENERIC = new Set([
  "store", "stores", "shop", "shops", "mart", "market", "supermarket", "super", "center", "centre", "centre",
  "corp", "corporation", "inc", "incorporated", "company", "co", "ltd", "enterprises", "trading", "branch",
  "philippines", "phils", "food", "foods", "cafe", "restaurant", "the", "and", "group", "retail", "outlet",
]);

function tokens(text: string): string[] {
  return normalize(text)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(" ")
    .filter((word) => word.length >= 4 && !GENERIC.has(word));
}

/** True when a past transaction's note refers to the same shop. */
export function sameMerchant(note: string, merchant: string): boolean {
  const a = normalize(note);
  const b = normalize(merchant);
  if (!a || !b) return false;
  if (a === b) return true;
  const merchantWords = tokens(b);
  const noteWords = new Set(tokens(a));
  if (!merchantWords.length || !noteWords.size) return false;
  return merchantWords.some((word) => noteWords.has(word));
}

/**
 * Decides which category a scanned receipt belongs to, on the device:
 * first from how you've filed this shop before, then from the shop's name,
 * then from what's printed on the receipt.
 */
export function guessReceiptCategory(
  receipt: Pick<ParsedReceipt, "merchant" | "items">,
  ctx: { categories: readonly Category[]; transactions: readonly Transaction[] },
): CategoryGuess {
  const expenseCategories = ctx.categories.filter((c) => c.kind === "expense" && !c.archived);
  const nameOf = (id: ID) => ctx.categories.find((c) => c.id === id)?.name ?? "that category";
  const merchant = receipt.merchant?.trim() ?? "";
  const itemText = receipt.items.map((item) => item.label).join(" ");
  const keywordRanking = scoreCategories(normalize(`${merchant} ${itemText}`), expenseCategories, "expense");
  const alternatives = keywordRanking.slice(0, 3).map((m) => m.categoryId);

  // 1. How you filed this shop before — your own habits win.
  if (merchant) {
    const counts = new Map<ID, number>();
    for (const tx of ctx.transactions) {
      if (tx.type !== "expense" || !tx.categoryId || tx.receivableId) continue;
      if (!sameMerchant(tx.note, merchant)) continue;
      counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    }
    const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (best && expenseCategories.some((c) => c.id === best[0])) {
      const [categoryId, count] = best;
      return {
        categoryId,
        confidence: count >= 2 ? 0.95 : 0.8,
        reason: "history",
        detail: count >= 2 ? `You've filed ${merchant} under ${nameOf(categoryId)} ${count} times.` : `Last time, ${merchant} went to ${nameOf(categoryId)}.`,
        alternatives: [categoryId, ...alternatives].filter((id, i, all) => all.indexOf(id) === i).slice(1, 4),
      };
    }
  }

  // 2. The shop's name — "Starbucks" is Food, "Shell" is Transport.
  if (merchant) {
    const byName = scoreCategories(normalize(merchant), expenseCategories, "expense");
    if (byName.length && byName[0].score >= 3 && (byName.length === 1 || byName[0].score > byName[1].score)) {
      const categoryId = byName[0].categoryId;
      return {
        categoryId,
        confidence: byName[0].score >= 4 ? 0.8 : 0.7,
        reason: "merchant",
        detail: `${merchant} looks like ${nameOf(categoryId)}.`,
        alternatives: alternatives.filter((id) => id !== categoryId).slice(0, 3),
      };
    }
  }

  // 3. What's on the receipt.
  const byItems = scoreCategories(normalize(itemText), expenseCategories, "expense");
  if (byItems.length && byItems[0].score >= 3) {
    const categoryId = byItems[0].categoryId;
    const hint = receipt.items.find((item) => scoreCategories(normalize(item.label), expenseCategories, "expense")[0]?.categoryId === categoryId);
    return {
      categoryId,
      confidence: byItems.length > 1 && byItems[0].score === byItems[1].score ? 0.5 : 0.65,
      reason: "items",
      detail: hint ? `“${hint.label}” on the receipt points to ${nameOf(categoryId)}.` : `What's on the receipt looks like ${nameOf(categoryId)}.`,
      alternatives: alternatives.filter((id) => id !== categoryId).slice(0, 3),
    };
  }

  return { categoryId: null, confidence: 0, reason: null, detail: null, alternatives };
}
