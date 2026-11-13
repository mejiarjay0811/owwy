import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { filterTransactions, parseSearchQuery } from "@/lib/finance/search";
import { parseSmartInput } from "@/lib/finance/smart-input";
import { account, P, tx } from "./fixtures";

const TODAY = "2026-09-14"; // Monday
const cash = account({ name: "Cash", type: "cash" });
const bank = account({ name: "Main Wallet" });
const savings = account({ name: "Savings", type: "savings" });
const ctx = { categories: DEFAULT_CATEGORIES, accounts: [cash, bank, savings], today: TODAY, currency: "PHP" as const };

describe("smart input", () => {
  it("reads 'coffee 180' as a food expense", () => {
    const r = parseSmartInput("coffee 180", ctx);
    expect(r).toMatchObject({ amount: P(180), type: "expense", categoryId: "cat_food", description: "Coffee", date: TODAY, needs: [] });
  });

  it("accepts the amount first, currency symbols and thousands", () => {
    expect(parseSmartInput("₱1,240 groceries", ctx)).toMatchObject({ amount: P(1240), categoryId: "cat_groceries" });
    expect(parseSmartInput("180 lunch", ctx)).toMatchObject({ amount: P(180), categoryId: "cat_food" });
    expect(parseSmartInput("laptop 1.5k", ctx).amount).toBe(P(1500));
  });

  it("does not mistake merchant names for amounts", () => {
    const r = parseSmartInput("7-eleven 85", ctx);
    expect(r.amount).toBe(P(85));
    expect(r.categoryId).toBe("cat_groceries");
  });

  it("detects income from signals and income categories", () => {
    expect(parseSmartInput("salary 30000", ctx)).toMatchObject({ type: "income", categoryId: "cat_salary", amount: P(30000) });
    expect(parseSmartInput("+500 from tita", ctx)).toMatchObject({ type: "income", amount: P(500) });
  });

  it("understands dates, accounts and tags", () => {
    const r = parseSmartInput("grab 245 yesterday cash #work", ctx);
    expect(r).toMatchObject({ amount: P(245), categoryId: "cat_transport", date: "2026-09-13", accountId: cash.id, tags: ["work"] });
    expect(parseSmartInput("dinner 600 sep 12", ctx).date).toBe("2026-09-12");
    expect(parseSmartInput("movie 400 saturday", ctx).date).toBe("2026-09-12");
    expect(parseSmartInput("shoes 2000 dec 25", ctx).date).toBe("2025-12-25");
  });

  it("recognizes transfers between accounts", () => {
    const r = parseSmartInput("transfer 2000 main wallet to savings", ctx);
    expect(r).toMatchObject({ type: "transfer", amount: P(2000), accountId: bank.id, toAccountId: savings.id, categoryId: null });
    expect(r.needs).toEqual([]);
  });

  it("asks when it can't tell", () => {
    const unknown = parseSmartInput("thing 300", ctx);
    expect(unknown.categoryId).toBeNull();
    expect(unknown.needs).toEqual(["category"]);
    const noAmount = parseSmartInput("coffee", ctx);
    expect(noAmount.needs).toContain("amount");
  });

  it("offers candidates when categories tie", () => {
    const r = parseSmartInput("gift 500", ctx); // matches Shopping keyword only
    expect(r.categoryId).toBe("cat_shopping");
    const tie = parseSmartInput("food groceries 900", ctx);
    expect(tie.categoryId).toBeNull();
    expect(tie.categoryCandidates).toEqual(expect.arrayContaining(["cat_food", "cat_groceries"]));
  });
});

describe("search", () => {
  const transactions = [
    tx({ type: "expense", amount: P(180), accountId: cash.id, categoryId: "cat_food", note: "Coffee", date: "2026-09-12" }),
    tx({ type: "expense", amount: P(650), accountId: bank.id, categoryId: "cat_food", note: "Dinner", date: "2026-09-10", tags: ["friends"] }),
    tx({ type: "expense", amount: P(245), accountId: cash.id, categoryId: "cat_transport", note: "Grab", date: "2026-08-20" }),
    tx({ type: "income", amount: P(30000), accountId: bank.id, categoryId: "cat_salary", note: "Salary", date: "2026-09-01" }),
    tx({ type: "expense", amount: P(1200), accountId: bank.id, categoryId: "cat_shopping", note: "Coffee maker", date: "2025-09-05" }),
  ];
  const lookups = {
    categoriesById: new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c])),
    accountsById: new Map([cash, bank, savings].map((a) => [a.id, a])),
  };
  const search = (q: string) => filterTransactions(transactions, parseSearchQuery(q, ctx), lookups).map((t) => t.note);

  it("matches notes without matching category keywords", () => {
    expect(search("coffee")).toEqual(["Coffee", "Coffee maker"]);
  });

  it("filters by category and amount", () => {
    const filters = parseSearchQuery("food over ₱500", ctx);
    expect(filters.categoryIds).toEqual(["cat_food"]);
    expect(filters.minAmount).toBe(P(500));
    expect(search("food over ₱500")).toEqual(["Dinner"]);
    expect(search("under 200")).toEqual(["Coffee"]);
  });

  it("understands months and relative periods", () => {
    expect(search("september")).toEqual(["Coffee", "Dinner", "Salary"]);
    expect(search("september 2025")).toEqual(["Coffee maker"]);
    expect(search("last month")).toEqual(["Grab"]);
    expect(parseSearchQuery("december", ctx).from).toBe("2025-12-01");
  });

  it("filters by type, account and tag", () => {
    expect(search("income")).toEqual(["Salary"]);
    expect(search("transport")).toEqual(["Grab"]);
    expect(search("cash")).toEqual(["Coffee", "Grab"]);
    expect(search("#friends")).toEqual(["Dinner"]);
  });
});
