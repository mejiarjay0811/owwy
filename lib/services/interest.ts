import { INTEREST_CATEGORY_ID } from "@/lib/defaults/categories";
import { planInterest } from "@/lib/finance/interest";
import { getDB } from "@/lib/storage/db";
import { buildTransaction } from "@/lib/storage/repositories/transactions";
import type { ISODate } from "@/types/models";

/**
 * Posts after-tax interest for every completed month on interest-earning
 * accounts. Idempotent: each account remembers the last month it was paid for.
 */
export async function postInterest(today: ISODate): Promise<number> {
  const db = getDB();
  return db.transaction("rw", db.accounts, db.transactions, db.categories, async () => {
    const accounts = (await db.accounts.toArray()).filter((a) => (a.interestRate ?? 0) > 0 && !a.archived);
    if (!accounts.length) return 0;
    const hasCategory = Boolean(await db.categories.get(INTEREST_CATEGORY_ID));
    let posted = 0;

    for (const account of accounts) {
      const history = await db.transactions.where("accountId").equals(account.id).or("toAccountId").equals(account.id).toArray();
      const plan = planInterest(account, history, today);
      if (!plan.length) continue;
      for (const month of plan) {
        if (month.net <= 0 || !hasCategory) continue;
        const tax = account.interestTaxRate ?? 0;
        await db.transactions.add(
          buildTransaction({
            type: "income",
            amount: month.net,
            accountId: account.id,
            categoryId: INTEREST_CATEGORY_ID,
            date: month.date,
            note: tax > 0 ? `Interest (after ${tax}% tax)` : "Interest",
          }),
        );
        posted++;
      }
      await db.accounts.update(account.id, { interestPostedThrough: plan[plan.length - 1].month });
    }
    return posted;
  });
}
