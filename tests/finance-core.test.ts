import { describe, expect, it } from "vitest";
import { computeBalances, computeTotals } from "@/lib/finance/balances";
import { advanceBillAfterPayment, billOccurrences, billStatus, monthlyEquivalent } from "@/lib/finance/bills";
import { budgetStatus, computeBudgetProgress, monthElapsedPercent, planBudgetCopy } from "@/lib/finance/budgets";
import { computeDebtProgress } from "@/lib/finance/debts";
import { computeGoalProgress, goalSaved, monthsUntil } from "@/lib/finance/goals";
import { computeNetWorth } from "@/lib/finance/net-worth";
import { planRecurringCatchUp } from "@/lib/finance/recurring";
import { nextIncomeDate, nextScheduledPayday } from "@/lib/finance/schedule";
import { percentChange, savingsRate, summarizeMonth } from "@/lib/finance/summary";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import type { Budget } from "@/types/models";
import { account, bill, debt, goal, P, recurring, tx } from "./fixtures";

describe("balances", () => {
  it("applies income, expenses and transfers to the right accounts", () => {
    const wallet = account({ openingBalance: P(1000) });
    const savings = account({ type: "savings", openingBalance: P(5000), includeInSafeToSpend: false });
    const balances = computeBalances(
      [wallet, savings],
      [
        tx({ type: "income", amount: P(30000), accountId: wallet.id }),
        tx({ type: "expense", amount: P(500), accountId: wallet.id }),
        tx({ type: "transfer", amount: P(2000), accountId: wallet.id, toAccountId: savings.id }),
      ],
    );
    expect(balances.get(wallet.id)).toBe(P(28500));
    expect(balances.get(savings.id)).toBe(P(7000));
  });

  it("ignores transactions for unknown accounts", () => {
    const wallet = account({ openingBalance: P(100) });
    const balances = computeBalances([wallet], [tx({ type: "expense", amount: P(50), accountId: "gone" })]);
    expect(balances.get(wallet.id)).toBe(P(100));
    expect(balances.has("gone")).toBe(false);
  });

  it("separates what you hold from what you owe", () => {
    const wallet = account({ openingBalance: P(8450) });
    const savings = account({ type: "savings", openingBalance: P(25000), includeInSafeToSpend: false });
    const card = account({ type: "credit", openingBalance: -P(4820), includeInSafeToSpend: false });
    const archived = account({ openingBalance: P(999), archived: true });
    const all = [wallet, savings, card, archived];
    const totals = computeTotals(all, computeBalances(all, []));
    expect(totals).toEqual({ totalBalance: P(33450), spendable: P(8450), savings: P(25000), owed: P(4820) });
  });
});

describe("monthly summary", () => {
  const wallet = account();
  const savings = account({ type: "savings", includeInSafeToSpend: false });
  const bank = account();
  const phone = goal({ accountId: savings.id });

  const transactions = [
    tx({ type: "income", amount: P(30000), accountId: wallet.id, date: "2026-09-01" }),
    tx({ type: "expense", amount: P(180), accountId: wallet.id, date: "2026-09-02", categoryId: "cat_food" }),
    tx({ type: "expense", amount: P(1240), accountId: wallet.id, date: "2026-09-02", categoryId: "cat_groceries" }),
    tx({ type: "expense", amount: P(500), accountId: wallet.id, date: "2026-08-31", categoryId: "cat_food" }),
    tx({ type: "transfer", amount: P(3000), accountId: wallet.id, toAccountId: savings.id, date: "2026-09-02", goalId: phone.id }),
    tx({ type: "transfer", amount: P(1000), accountId: wallet.id, toAccountId: bank.id, date: "2026-09-03" }),
    tx({ type: "transfer", amount: P(500), accountId: savings.id, toAccountId: wallet.id, date: "2026-09-05" }),
  ];

  it("totals income, spending and net savings within the month only", () => {
    const summary = summarizeMonth(transactions, [wallet, savings, bank], [phone], "2026-09");
    expect(summary.income).toBe(P(30000));
    expect(summary.spent).toBe(P(1420));
    expect(summary.saved).toBe(P(2500)); // 3,000 in, 500 back out; wallet→bank is not saving
    expect(summary.net).toBe(P(28580));
    expect(summary.byCategory.get("cat_food")).toBe(P(180));
    expect(summary.byDay.get("2026-09-02")).toBe(P(1420));
    expect(summary.expenseCount).toBe(2);
  });

  it("computes savings rate and percent change safely", () => {
    expect(savingsRate({ income: P(30000), saved: P(4000) })).toBeCloseTo(13.33, 2);
    expect(savingsRate({ income: 0, saved: P(4000) })).toBe(0);
    expect(percentChange(P(1200), P(1000))).toBe(20);
    expect(percentChange(P(100), 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe("budgets", () => {
  const budget = (categoryId: string, amount: number, month = "2026-09"): Budget => ({
    id: `b_${categoryId}_${month}`,
    categoryId,
    month,
    amount: P(amount),
    paused: false,
    createdAt: 0,
  });

  it("judges status by usage and month pace", () => {
    expect(budgetStatus(128, 50)).toBe("over");
    expect(budgetStatus(92, 50)).toBe("near");
    expect(budgetStatus(60, 20)).toBe("watch");
    expect(budgetStatus(60, 70)).toBe("calm");
  });

  it("computes progress per category", () => {
    const spending = new Map([
      ["cat_food", P(3500)],
      ["cat_shopping", P(3200)],
    ]);
    const progress = computeBudgetProgress(
      [budget("cat_food", 5000), budget("cat_shopping", 2500), budget("cat_food", 9999, "2026-08")],
      DEFAULT_CATEGORIES,
      spending,
      "2026-09",
      "2026-09-15",
    );
    expect(progress).toHaveLength(2);
    const shopping = progress.find((p) => p.budget.categoryId === "cat_shopping")!;
    expect(shopping.percent).toBe(128);
    expect(shopping.remaining).toBe(-P(700));
    expect(shopping.status).toBe("over");
    const food = progress.find((p) => p.budget.categoryId === "cat_food")!;
    expect(food.percent).toBe(70);
    expect(food.projected).toBe(P(7000));
  });

  it("knows how far into the month we are", () => {
    expect(monthElapsedPercent("2026-09", "2026-09-15")).toBe(50);
    expect(monthElapsedPercent("2026-09", "2026-10-01")).toBe(100);
    expect(monthElapsedPercent("2026-09", "2026-08-31")).toBe(0);
  });

  it("copies only categories not already budgeted", () => {
    const all = [budget("cat_food", 5000, "2026-08"), budget("cat_transport", 3000, "2026-08"), budget("cat_food", 6000, "2026-09")];
    expect(planBudgetCopy(all, "2026-08", "2026-09").map((b) => b.categoryId)).toEqual(["cat_transport"]);
  });
});

describe("bills", () => {
  it("reports status relative to today", () => {
    expect(billStatus(bill({ nextDueDate: "2026-09-13" }), "2026-09-14")).toBe("overdue");
    expect(billStatus(bill({ nextDueDate: "2026-09-15" }), "2026-09-14")).toBe("dueSoon");
    expect(billStatus(bill({ nextDueDate: "2026-10-15", lastPaidDate: "2026-09-12" }), "2026-09-14")).toBe("paid");
    expect(billStatus(bill({ nextDueDate: "2026-09-30" }), "2026-09-14")).toBe("upcoming");
    expect(billStatus(bill({ active: false }), "2026-09-14")).toBe("inactive");
  });

  it("lists unpaid occurrences including overdue ones", () => {
    const overdue = bill({ nextDueDate: "2026-09-10", name: "Water" });
    const weekly = bill({ nextDueDate: "2026-09-16", frequency: "weekly", name: "Allowance" });
    const occurrences = billOccurrences([overdue, weekly], "2026-09-14", "2026-09-30");
    expect(occurrences.map((o) => o.date)).toEqual(["2026-09-10", "2026-09-16", "2026-09-23", "2026-09-30"]);
    expect(occurrences[0].isNext).toBe(true);
    expect(occurrences[2].isNext).toBe(false);
  });

  it("advances after payment, keeping month-end anchors", () => {
    expect(advanceBillAfterPayment(bill({ nextDueDate: "2026-01-31", anchorDay: 31 }), "2026-01-30")).toEqual({
      nextDueDate: "2026-02-28",
      lastPaidDate: "2026-01-30",
      active: true,
    });
    expect(advanceBillAfterPayment(bill({ frequency: "once" }), "2026-09-14").active).toBe(false);
  });

  it("normalizes costs to a monthly figure", () => {
    expect(monthlyEquivalent(P(1200), "yearly")).toBe(P(100));
    expect(monthlyEquivalent(P(100), "weekly")).toBe(Math.round((P(100) * 52) / 12));
  });
});

describe("savings goals", () => {
  const wallet = account();
  const savings = account({ type: "savings" });

  it("counts contributions and withdrawals through the goal account", () => {
    const g = goal({ accountId: savings.id, startingAmount: P(12500) });
    const history = [
      tx({ type: "transfer", amount: P(3000), accountId: wallet.id, toAccountId: savings.id, goalId: g.id, date: "2026-08-02" }),
      tx({ type: "transfer", amount: P(3000), accountId: wallet.id, toAccountId: savings.id, goalId: g.id, date: "2026-09-02" }),
      tx({ type: "transfer", amount: P(500), accountId: savings.id, toAccountId: wallet.id, goalId: g.id, date: "2026-09-05" }),
      tx({ type: "transfer", amount: P(9999), accountId: wallet.id, toAccountId: savings.id, date: "2026-09-05" }),
    ];
    expect(goalSaved(g, history)).toBe(P(18000));
  });

  it("suggests a monthly amount to reach the target date", () => {
    const g = goal({ accountId: savings.id, targetAmount: P(40000), startingAmount: P(18500), targetDate: "2026-12-20" });
    const progress = computeGoalProgress(g, [], "2026-09-14");
    expect(progress.remaining).toBe(P(21500));
    expect(progress.percent).toBeCloseTo(46.25, 2);
    expect(progress.monthsLeft).toBe(4);
    expect(progress.requiredMonthly).toBe(P(5375));
    expect(progress.pace).toBe("behind");
  });

  it("marks completed goals and those without deadlines", () => {
    const done = computeGoalProgress(goal({ accountId: savings.id, targetAmount: P(100), startingAmount: P(150) }), [], "2026-09-14");
    expect(done.pace).toBe("complete");
    expect(done.percent).toBe(100);
    expect(done.requiredMonthly).toBe(0);
    const open = computeGoalProgress(goal({ accountId: savings.id }), [], "2026-09-14");
    expect(open.pace).toBe("noDeadline");
    expect(monthsUntil("2026-09-14", "2026-09-01")).toBe(0);
  });
});

describe("debts", () => {
  it("subtracts payments from standalone debts", () => {
    const d = debt({ startingBalance: P(5000), originalAmount: P(5000), minimumPayment: P(1000) });
    const progress = computeDebtProgress(
      d,
      [tx({ type: "expense", amount: P(1000), accountId: "a", debtId: d.id, date: "2026-09-03" })],
      new Map(),
      "2026-09-14",
    );
    expect(progress.remaining).toBe(P(4000));
    expect(progress.percent).toBe(20);
    expect(progress.monthsToPayoff).toBe(4);
    expect(progress.minimumMetThisMonth).toBe(true);
  });

  it("uses the live balance of a linked credit account", () => {
    const card = account({ type: "credit" });
    const d = debt({ accountId: card.id, startingBalance: P(12500), originalAmount: P(12500) });
    const progress = computeDebtProgress(d, [], new Map([[card.id, -P(4820)]]), "2026-09-14");
    expect(progress.remaining).toBe(P(4820));
    expect(progress.paid).toBe(P(7680));
  });
});

describe("net worth", () => {
  it("adds assets and subtracts liabilities without double counting", () => {
    const cash = account({ type: "cash" });
    const card = account({ type: "credit" });
    const balances = new Map([
      [cash.id, P(10000)],
      [card.id, -P(5000)],
    ]);
    const linked = computeDebtProgress(debt({ accountId: card.id }), [], balances, "2026-09-14");
    const loan = computeDebtProgress(debt({ startingBalance: P(10000) }), [], balances, "2026-09-14");
    const worth = computeNetWorth([cash, card], balances, [linked, loan]);
    expect(worth.totalAssets).toBe(P(10000));
    expect(worth.totalLiabilities).toBe(P(15000));
    expect(worth.netWorth).toBe(-P(5000));
  });
});

describe("income schedule", () => {
  it("finds the next payday for common schedules", () => {
    expect(nextScheduledPayday({ frequency: "semimonthly", paydays: [15, 31] }, "2026-09-14")).toBe("2026-09-15");
    expect(nextScheduledPayday({ frequency: "semimonthly", paydays: [15, 31] }, "2026-09-15")).toBe("2026-09-30");
    expect(nextScheduledPayday({ frequency: "monthly", paydays: [1] }, "2026-09-14")).toBe("2026-10-01");
    expect(nextScheduledPayday({ frequency: "monthly", paydays: [31] }, "2026-02-10")).toBe("2026-02-28");
    expect(nextScheduledPayday({ frequency: "biweekly", paydays: [], anchorDate: "2026-09-04" }, "2026-09-14")).toBe("2026-09-18");
    expect(nextScheduledPayday({ frequency: "irregular", paydays: [] }, "2026-09-14")).toBe("2026-10-01");
  });

  it("prefers an earlier recurring income rule", () => {
    const rule = recurring({ accountId: "a", nextDate: "2026-09-20" });
    expect(nextIncomeDate({ frequency: "monthly", paydays: [30] }, [rule], "2026-09-14")).toBe("2026-09-20");
    expect(nextIncomeDate({ frequency: "monthly", paydays: [15] }, [rule], "2026-09-14")).toBe("2026-09-15");
  });
});

describe("recurring catch-up", () => {
  it("posts every missed occurrence once and advances", () => {
    const rule = recurring({ accountId: "a", frequency: "weekly", nextDate: "2026-08-31", anchorDay: 31 });
    const plan = planRecurringCatchUp(rule, "2026-09-14");
    expect(plan.dates).toEqual(["2026-08-31", "2026-09-07", "2026-09-14"]);
    expect(plan.nextDate).toBe("2026-09-21");
    expect(plan.active).toBe(true);
  });

  it("stops at the end date", () => {
    const rule = recurring({ accountId: "a", nextDate: "2026-07-01", endDate: "2026-08-15" });
    const plan = planRecurringCatchUp(rule, "2026-09-14");
    expect(plan.dates).toEqual(["2026-07-01", "2026-08-01"]);
    expect(plan.active).toBe(false);
  });

  it("does nothing when nothing is due", () => {
    const rule = recurring({ accountId: "a", nextDate: "2026-10-01" });
    expect(planRecurringCatchUp(rule, "2026-09-14")).toEqual({ dates: [], nextDate: "2026-10-01", active: true });
  });
});
