import { describe, expect, it } from "vitest";
import { answerLocally, looksLikeQuestion, type AssistantContext } from "@/lib/assistant/local-engine";
import { runTool } from "@/lib/assistant/tools";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { monthlyInterest, planInterest } from "@/lib/finance/interest";
import { parseLogEntries } from "@/lib/finance/log-splitter";
import { pendingAutomations } from "@/lib/finance/recurring";
import { computeFinanceState } from "@/lib/finance/state";
import { cashFlowHistory, netWorthHistory, periodEnds, projectBalance } from "@/lib/finance/trends";
import type { ChatBlock, OwwyDataset } from "@/types/models";
import { account, bill, dataset, P, recurring, tx } from "./fixtures";

const TODAY = "2026-09-14";
const gcash = account({ name: "GCash", type: "ewallet" });
const maya = account({ name: "Maya", type: "ewallet" });
const bank = account({ name: "Main Wallet", openingBalance: P(50000) });
const smartCtx = { categories: DEFAULT_CATEGORIES, accounts: [gcash, maya, bank], today: TODAY, currency: "PHP" as const };

function ctxFor(overrides: Partial<OwwyDataset> = {}, brief = true): AssistantContext {
  const data = dataset({ accounts: [gcash, maya, bank], ...overrides });
  data.settings.income = { frequency: "monthly", paydays: [1] };
  return { data, state: computeFinanceState(data, TODAY), today: TODAY, currency: "PHP", brief };
}

const textOf = (blocks: ChatBlock[]) => blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(" ");
const queryOf = (blocks: ChatBlock[]) => blocks.find((b) => b.type === "query") as Extract<ChatBlock, { type: "query" }> | undefined;

describe("logging many things in one sentence", () => {
  it("splits two amounts that share an account", () => {
    const result = parseLogEntries("lunch 250 and grab home 120, gcash", smartCtx);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((e) => [e.amount, e.categoryId, e.accountId])).toEqual([
      [P(250), "cat_food", gcash.id],
      [P(120), "cat_transport", gcash.id],
    ]);
    expect(result.summary).toBe("That is two expenses, both on GCash.");
  });

  it("keeps each item's own account", () => {
    const result = parseLogEntries("I spent 50 on food from gcash and 100 on coffee from maya", smartCtx);
    expect(result.entries.map((e) => [e.amount, e.accountId, e.categoryId])).toEqual([
      [P(50), gcash.id, "cat_food"],
      [P(100), maya.id, "cat_food"],
    ]);
    expect(result.summary).toBe("That is two expenses.");
  });

  it("does not split single items or thousands separators", () => {
    expect(parseLogEntries("₱1,240 groceries", smartCtx).entries).toHaveLength(1);
    const beans = parseLogEntries("rice and beans 120", smartCtx);
    expect(beans.entries).toHaveLength(1);
    expect(beans.entries[0].amount).toBe(P(120));
  });

  it("applies a shared date", () => {
    const result = parseLogEntries("coffee 150; taxi 200; yesterday", smartCtx);
    expect(result.entries.map((e) => e.date)).toEqual(["2026-09-13", "2026-09-13"]);
  });
});

describe("Ask Owwy on device", () => {
  const history = [
    tx({ type: "expense", amount: P(12000), accountId: bank.id, categoryId: "cat_housing", note: "Rent", date: "2026-08-05" }),
    tx({ type: "expense", amount: P(6000), accountId: bank.id, categoryId: "cat_food", note: "Groceries at SM", date: "2026-08-10" }),
    tx({ type: "expense", amount: P(3000), accountId: gcash.id, categoryId: "cat_food", note: "Restaurants", date: "2026-08-20" }),
    tx({ type: "expense", amount: P(2000), accountId: gcash.id, categoryId: "cat_food", note: "Restaurants", date: "2026-07-20" }),
    tx({ type: "expense", amount: P(1000), accountId: bank.id, categoryId: "cat_food", note: "Groceries at SM", date: "2026-07-10" }),
    tx({ type: "expense", amount: P(2245), accountId: bank.id, categoryId: "cat_utilities", note: "Electricity", date: "2026-08-15", billId: "bill_e" }),
    tx({ type: "expense", amount: P(245), accountId: gcash.id, categoryId: "cat_transport", note: "Grab", date: "2026-08-21" }),
  ];
  const ctx = ctxFor({ transactions: history, bills: [bill({ id: "bill_e", name: "Electricity", nextDueDate: "2026-09-15" })] });

  it("tells questions apart from things to log", () => {
    expect(looksLikeQuestion("coffee 180")).toBe(false);
    expect(looksLikeQuestion("lunch 250 and grab home 120, gcash")).toBe(false);
    expect(looksLikeQuestion("Where did my money go last month?")).toBe(true);
    expect(looksLikeQuestion("how much did I spend on food over 500")).toBe(true);
    expect(looksLikeQuestion("is my food spending going up")).toBe(true);
  });

  it("stages transactions instead of saving them", () => {
    const reply = answerLocally("lunch 250 and grab home 120, gcash", ctx);
    const staged = reply.blocks.find((b) => b.type === "staged") as Extract<ChatBlock, { type: "staged" }>;
    expect(staged.status).toBe("pending");
    expect(staged.drafts.map((d) => d.amount)).toEqual([P(250), P(120)]);
    expect(textOf(reply.blocks)).toContain("both on GCash");
  });

  it("breaks down where the money went, showing its work", () => {
    const reply = answerLocally("Where did my money go last month?", ctx);
    const q = queryOf(reply.blocks)!;
    expect(q.query).toContain("BETWEEN '2026-08-01' AND '2026-08-31'");
    expect(q.rows[0]).toEqual(["Housing", "12,000.00", 1]);
    expect(q.rows[1]).toEqual(["Food", "9,000.00", 2]);
    expect(textOf(reply.blocks)).toContain("**₱12,000.00**");
  });

  it("answers whether a category is going up", () => {
    const reply = answerLocally("Is my food spending going up?", { ...ctx, brief: false });
    const text = textOf(reply.blocks);
    expect(text).toMatch(/^Yes\. Food came to \*\*₱9,000\.00\*\* in August, against ₱3,000\.00 in July: 200% up\./);
    expect(text).toContain("Most of that is **Groceries at sm**");
  });

  it("finds the last payment of a bill", () => {
    const reply = answerLocally("Electricity is due tomorrow — what was the last one?", ctx);
    expect(textOf(reply.blocks)).toContain("The last **Electricity** was **₱2,245.00** on Aug 15");
  });

  it("totals spending with filters", () => {
    const reply = answerLocally("How much did I spend on transport last month?", ctx);
    expect(textOf(reply.blocks)).toBe("You spent **₱245.00** on Transport in August, across 1 transaction.");
    expect(queryOf(reply.blocks)!.query).toContain("category IN ('Transport')");
  });

  it("explains Safe to Spend and affordability", () => {
    expect(textOf(answerLocally("how much can I spend until payday?", ctx).blocks)).toContain("You can safely spend about");
    expect(textOf(answerLocally("can I afford 3500?", ctx).blocks)).toContain("Comfortable");
  });

  it("offers help for anything else", () => {
    const reply = answerLocally("hello owl", ctx);
    expect(reply.blocks.some((b) => b.type === "suggestions")).toBe(true);
  });
});

describe("AI tools run locally", () => {
  const ctx = ctxFor({
    transactions: [
      tx({ type: "expense", amount: P(500), accountId: gcash.id, categoryId: "cat_food", note: "Secret dinner", date: "2026-09-10" }),
      tx({ type: "expense", amount: P(300), accountId: bank.id, categoryId: "cat_transport", note: "Taxi", date: "2026-09-11" }),
    ],
  });

  it("groups query results and returns only what's asked", () => {
    const run = runTool("query_transactions", { type: "expense", from: "2026-09-01", to: "2026-09-30", group_by: "category" }, ctx, { shareNotes: true });
    const payload = JSON.parse(run.result);
    expect(payload.total).toBe(800);
    expect(payload.rows).toEqual([
      { category: "Food", total: 500, count: 1 },
      { category: "Transport", total: 300, count: 1 },
    ]);
    expect(run.block?.type).toBe("query");
  });

  it("hides notes when sharing is off", () => {
    const run = runTool("query_transactions", { text: "" }, ctx, { shareNotes: false });
    expect(run.result).not.toContain("Secret dinner");
  });

  it("stages transactions from names, never saving", () => {
    const run = runTool("stage_transactions", { transactions: [{ type: "expense", amount: 50, category: "food", account: "gcash", note: "Food" }] }, ctx, { shareNotes: true });
    const block = run.block as Extract<ChatBlock, { type: "staged" }>;
    expect(block.drafts[0]).toMatchObject({ amount: P(50), categoryId: "cat_food", accountId: gcash.id, date: TODAY });
    expect(ctx.data.transactions).toHaveLength(2);
  });

  it("reports invalid input as a tool error", () => {
    const run = runTool("stage_transactions", { transactions: [{ type: "expense", amount: -5 }] }, ctx, { shareNotes: true });
    expect(run.isError).toBe(true);
  });
});

describe("interest", () => {
  it("computes monthly after-tax interest", () => {
    expect(monthlyInterest(P(25000), 4, 20)).toEqual({ gross: 8333, tax: 1667, net: 6666 });
    expect(monthlyInterest(-P(100), 4, 20).net).toBe(0);
  });

  it("plans completed months since the last posting, compounding", () => {
    const savings = account({ type: "savings", openingBalance: P(12000), interestRate: 12, interestTaxRate: 0, interestPostedThrough: "2026-06" });
    const plan = planInterest(savings, [], TODAY);
    expect(plan.map((p) => p.month)).toEqual(["2026-07", "2026-08"]);
    expect(plan[0].net).toBe(P(120));
    expect(plan[1].balance).toBe(P(12120));
    expect(plan[1].net).toBe(12120);
  });

  it("does nothing without a rate or once caught up", () => {
    expect(planInterest(account({ type: "savings" }), [], TODAY)).toEqual([]);
    expect(planInterest(account({ type: "savings", interestRate: 5, interestPostedThrough: "2026-08" }), [], TODAY)).toEqual([]);
  });
});

describe("trends and projection", () => {
  const wallet = account({ openingBalance: P(1000) });
  const transactions = [
    tx({ type: "income", amount: P(30000), accountId: wallet.id, date: "2026-08-01" }),
    tx({ type: "expense", amount: P(10000), accountId: wallet.id, date: "2026-08-10" }),
    tx({ type: "expense", amount: P(5000), accountId: wallet.id, date: "2026-09-05" }),
  ];

  it("tracks net worth over time", () => {
    const points = netWorthHistory([wallet], transactions, [], periodEnds("monthly", TODAY, 3));
    expect(points.map((p) => [p.key, p.value])).toEqual([
      ["2026-07", P(1000)],
      ["2026-08", P(21000)],
      ["2026-09", P(16000)],
    ]);
  });

  it("summarizes monthly cash flow", () => {
    const flow = cashFlowHistory(transactions, [wallet], [], TODAY, 2);
    expect(flow.map((f) => [f.month, f.income, f.spent])).toEqual([
      ["2026-08", P(30000), P(10000)],
      ["2026-09", 0, P(5000)],
    ]);
  });

  it("projects balance from automations, bills and average spending", () => {
    const salary = recurring({ accountId: wallet.id, amount: P(30000), nextDate: "2026-10-01" });
    const internet = bill({ amount: P(1500), nextDueDate: "2026-10-18" });
    const { points } = projectBalance({ today: TODAY, startBalance: P(16000), transactions, recurring: [salary], bills: [internet], months: 2 });
    expect(points[1].month).toBe("2026-10");
    expect(points[1].income).toBeGreaterThanOrEqual(P(30000));
    expect(points[1].scheduled).toBe(P(1500));
  });
});

describe("ask-first automations", () => {
  it("lists only confirm-mode rules that are due", () => {
    const rules = [
      recurring({ accountId: "a", mode: "confirm", nextDate: "2026-09-14" }),
      recurring({ accountId: "a", mode: "confirm", nextDate: "2026-09-20" }),
      recurring({ accountId: "a", mode: "auto", nextDate: "2026-09-01" }),
    ];
    expect(pendingAutomations(rules, TODAY)).toHaveLength(1);
  });
});
