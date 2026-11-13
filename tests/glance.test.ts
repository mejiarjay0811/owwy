import { describe, expect, it } from "vitest";
import { relativeDatePhrase } from "@/lib/dates";
import { forecastMonth } from "@/lib/finance/forecast";
import { computePayday } from "@/lib/finance/payday";
import { computeReminders, remindersHeadline } from "@/lib/finance/reminders";
import { spendingSeries } from "@/lib/finance/spending";
import { accountBalanceHistory } from "@/lib/finance/trends";
import type { MoneyMove } from "@/lib/finance/upcoming";
import type { Account, RecurringTransaction, Transaction } from "@/types/models";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? Math.random().toString(36),
  type: "expense",
  amount: 100_00,
  accountId: "a1",
  date: "2026-09-15",
  note: "",
  createdAt: 0,
  updatedAt: 0,
  ...over,
}) as Transaction;

describe("spendingSeries", () => {
  const transactions = [
    tx({ date: "2026-09-15", amount: 250_00 }),
    tx({ date: "2026-09-14", amount: 100_00 }),
    tx({ date: "2026-09-14", amount: 50_00, type: "income" }),
    tx({ date: "2026-09-13", amount: 999_00, receivableId: "r1" }),
    tx({ date: "2026-09-09", amount: 70_00 }),
    tx({ date: "2026-08-20", amount: 1000_00 }),
  ];

  it("groups the last 7 days, ending today, ignoring income and lending", () => {
    const s = spendingSeries(transactions, "2026-09-15", "day");
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets[6]).toMatchObject({ start: "2026-09-15", amount: 250_00, current: true });
    expect(s.buckets[5].amount).toBe(100_00);
    expect(s.buckets[4].amount).toBe(0);
    expect(s.buckets[0]).toMatchObject({ start: "2026-09-09", amount: 70_00 });
    expect(s.current).toBe(250_00);
    expect(s.change).toBe(150);
  });

  it("groups weeks from the configured week start", () => {
    // 2026-09-15 is a Tuesday; Monday-start week begins 2026-09-14.
    const s = spendingSeries(transactions, "2026-09-15", "week", 1);
    expect(s.buckets[s.buckets.length - 1]).toMatchObject({ start: "2026-09-14", amount: 350_00 });
    expect(s.buckets[s.buckets.length - 2]).toMatchObject({ start: "2026-09-07", amount: 70_00 });
  });

  it("groups months", () => {
    const s = spendingSeries(transactions, "2026-09-15", "month");
    expect(s.buckets.map((b) => b.start).slice(-2)).toEqual(["2026-08-01", "2026-09-01"]);
    expect(s.buckets[5].amount).toBe(420_00);
    expect(s.buckets[4].amount).toBe(1000_00);
  });
});

describe("computePayday", () => {
  it("uses a matching salary automation for the expected amount", () => {
    const rule = { id: "r", name: "Salary", type: "income", amount: 25_000_00, active: true, nextDate: "2026-09-30", mode: "auto" } as RecurringTransaction;
    const p = computePayday({ frequency: "monthly", paydays: [30] }, [rule], [], "2026-09-15");
    expect(p).toMatchObject({ date: "2026-09-30", daysLeft: 15, expectedAmount: 25_000_00, basis: "automation", cycleDays: 30 });
  });

  it("falls back to the last salary-like income", () => {
    const p = computePayday({ frequency: "semimonthly", paydays: [15, 30] }, [], [tx({ type: "income", amount: 12_000_00, categoryId: "cat_salary", date: "2026-08-30" })], "2026-09-15");
    expect(p).toMatchObject({ date: "2026-09-30", expectedAmount: 12_000_00, basis: "last-payday", cycleDays: 15 });
  });
});

describe("computeReminders", () => {
  const move = (over: Partial<MoneyMove>): MoneyMove => ({ id: "m", direction: "out", source: "bill", refId: "b", label: "Rent", emoji: "🏠", date: "2026-09-16", amount: 8000_00, daysLeft: 1, overdue: false, ...over });

  it("orders overdue first, skips far-off items, and adds the review", () => {
    const reminders = computeReminders({
      today: "2026-09-15",
      month: "2026-09",
      expenses: [move({ id: "soon" }), move({ id: "late", label: "Internet", date: "2026-09-10", daysLeft: -5, overdue: true }), move({ id: "far", daysLeft: 12 })],
      recurring: [],
      budgets: [],
      receivables: [],
      snapshots: [{ id: "2026-08", seen: false }],
      paydayDaysLeft: 9,
    });
    expect(reminders.map((r) => r.id)).toEqual(["late", "soon", "review:2026-08"]);
    expect(reminders[0].title).toBe("Internet is overdue");
    expect(remindersHeadline(reminders)).toMatch(/One thing slipped/);
    expect(remindersHeadline([])).toMatch(/All quiet/);
  });

  it("shows an ask-first automation once, as a confirmation", () => {
    const rule = { id: "load", name: "Load for Mom", type: "expense", amount: 300_00, active: true, nextDate: "2026-09-15", mode: "confirm" } as RecurringTransaction;
    const reminders = computeReminders({
      today: "2026-09-15",
      month: "2026-09",
      expenses: [move({ id: "rec:load:2026-09-15", source: "automation", refId: "load", label: "Load for Mom", date: "2026-09-15", daysLeft: 0 })],
      recurring: [rule],
      budgets: [],
      receivables: [],
      snapshots: [],
      paydayDaysLeft: 9,
    });
    expect(reminders.map((r) => r.kind)).toEqual(["confirm"]);
  });
});

describe("relativeDatePhrase", () => {
  it("lowercases words but keeps month names", () => {
    expect(relativeDatePhrase("2026-09-15", "2026-09-15")).toBe("today");
    expect(relativeDatePhrase("2026-09-18", "2026-09-15")).toBe("in 3 days");
    expect(relativeDatePhrase("2026-09-30", "2026-09-15")).toBe("Sep 30");
  });
});

describe("forecastMonth", () => {
  it("adds scheduled items and everyday pace for the rest of the month", () => {
    const move = (over: Partial<MoneyMove>): MoneyMove => ({ id: Math.random().toString(), direction: "out", source: "bill", refId: "b", label: "", emoji: "", date: "2026-09-20", amount: 0, daysLeft: 5, overdue: false, ...over });
    const f = forecastMonth({
      today: "2026-09-10",
      transactions: [
        tx({ date: "2026-09-01", type: "income", amount: 20_000_00 }),
        tx({ date: "2026-09-02", amount: 5_000_00, billId: "rent" }),
        tx({ date: "2026-09-05", amount: 1_000_00 }),
        tx({ date: "2026-09-06", amount: 2_000_00, receivableId: "r" }),
        tx({ date: "2026-08-30", amount: 9_999_00 }),
      ],
      upcoming: {
        income: [move({ direction: "in", date: "2026-09-25", amount: 15_000_00 }), move({ direction: "in", date: "2026-10-10", amount: 15_000_00 })],
        expenses: [move({ date: "2026-09-20", amount: 1_500_00 }), move({ date: "2026-09-08", amount: 700_00, overdue: true, daysLeft: -2 })],
      },
    });
    expect(f).toMatchObject({ actualIncome: 20_000_00, expectedIncome: 15_000_00, actualSpent: 6_000_00, scheduledSpend: 2_200_00, everydayPerDay: 100_00, daysLeft: 20, everydaySpend: 2_000_00 });
    expect(f.projectedNet).toBe(35_000_00 - (6_000_00 + 2_200_00 + 2_000_00));
  });
});

describe("accountBalanceHistory", () => {
  it("replays transfers in both directions with the received amount", () => {
    const account = { id: "a1", openingBalance: 1000_00 } as Account;
    const history = accountBalanceHistory(
      account,
      [
        tx({ date: "2026-09-02", type: "income", amount: 500_00 }),
        tx({ date: "2026-09-03", type: "transfer", amount: 200_00, toAccountId: "a2" }),
        tx({ date: "2026-09-03", type: "transfer", accountId: "a3", toAccountId: "a1", amount: 10_00, toAmount: 560_00 }),
        tx({ date: "2026-09-04", accountId: "a2", amount: 1_00 }),
      ],
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
    );
    expect(history).toEqual([1000_00, 1500_00, 1860_00, 1860_00]);
  });
});
