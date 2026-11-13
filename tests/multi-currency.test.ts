import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { answerLocally } from "@/lib/assistant/local-engine";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { computeBalances } from "@/lib/finance/balances";
import { computePayday } from "@/lib/finance/payday";
import { computeReceivableProgress } from "@/lib/finance/receivables";
import { matchBill, parseSmartInput } from "@/lib/finance/smart-input";
import { computeFinanceState } from "@/lib/finance/state";
import { summarizeMonth } from "@/lib/finance/summary";
import { nextDayOfMonth, upcomingMoneyMoves } from "@/lib/finance/upcoming";
import { approximateRate, convertMinor, toBaseTransactions } from "@/lib/money/fx";
import { initializeApp } from "@/lib/services/app";
import { saveStagedDrafts, undoStagedSave } from "@/lib/services/staged";
import { getDB, OwwyDB, setDB } from "@/lib/storage/db";
import { createAccount } from "@/lib/storage/repositories/accounts";
import { createBill } from "@/lib/storage/repositories/bills";
import type { ChatBlock, Receivable } from "@/types/models";
import { account, bill, dataset, debt, P, recurring, tx } from "./fixtures";

const TODAY = "2026-09-14";
const fx = { base: "PHP" as const, rates: { USD: 56.5 } };

describe("currency conversion", () => {
  it("converts minor units with the user's rate, across decimal places", () => {
    expect(convertMinor(42000, "USD", "PHP", fx)).toBe(P(23730)); // $420.00 → ₱23,730.00
    expect(convertMinor(P(565), "PHP", "USD", fx)).toBe(1000); // ₱565 → $10.00
    expect(convertMinor(100000, "JPY", "PHP", { base: "PHP", rates: { JPY: 0.38 } })).toBe(P(38000)); // ¥100,000
    expect(convertMinor(P(100), "PHP", "PHP", fx)).toBe(P(100));
  });

  it("falls back to approximate rates when none is set", () => {
    expect(approximateRate("USD", "PHP")).toBe(56.5);
    expect(convertMinor(100, "EUR", "PHP", { base: "PHP", rates: {} })).toBeGreaterThan(5000);
  });

  it("keeps native balances but totals everything in the main currency", () => {
    const peso = account({ openingBalance: P(1000) });
    const wise = account({ name: "Wise USD", currency: "USD", openingBalance: 42000 });
    const data = dataset({
      accounts: [peso, wise],
      transactions: [
        // Move ₱5,650 into Wise; $100.00 arrives.
        tx({ type: "transfer", amount: P(5650), accountId: peso.id, toAccountId: wise.id, toAmount: 10000, date: "2026-09-10" }),
        tx({ type: "expense", amount: 2000, accountId: wise.id, categoryId: "cat_food", date: "2026-09-11" }),
      ],
    });
    data.settings.exchangeRates = { USD: 56.5 };
    data.accounts[0].openingBalance = P(10000);
    const s = computeFinanceState(data, TODAY);
    expect(s.multiCurrency).toBe(true);
    expect(s.balances.get(wise.id)).toBe(50000); // $500.00
    expect(s.baseBalances.get(wise.id)).toBe(P(28250));
    expect(s.totals.totalBalance).toBe(P(10000 - 5650 + 28250));
    // The $20 food expense counts as ₱1,130 of spending.
    expect(s.thisMonth.spent).toBe(P(1130));
  });

  it("leaves transactions untouched when every account uses the main currency", () => {
    const list = [tx({ type: "expense", amount: P(5), accountId: "a" })];
    expect(toBaseTransactions(list, new Map([["a", account({ id: "a" })]]), fx)).toBe(list);
  });
});

describe("money owed to you", () => {
  const receivable: Receivable = { id: "rcv1", person: "Migs", note: "Concert ticket", originalAmount: P(6000), startingCollected: 0, dueDate: "2026-09-10", archived: false, createdAt: 0, updatedAt: 0 };
  const wallet = account({ openingBalance: P(10000) });
  const history = [
    tx({ type: "expense", amount: P(6000), accountId: wallet.id, categoryId: "cat_other", receivableId: "rcv1", date: "2026-09-01" }),
    tx({ type: "income", amount: P(1500), accountId: wallet.id, categoryId: "cat_income_other", receivableId: "rcv1", date: "2026-09-08" }),
  ];

  it("tracks collection progress and overdue status", () => {
    const p = computeReceivableProgress(receivable, history, TODAY);
    expect(p).toMatchObject({ collected: P(1500), remaining: P(4500), status: "overdue", daysUntilDue: -4 });
    expect(p.percent).toBe(25);
  });

  it("isn't counted as spending or income, but counts toward net worth", () => {
    const summary = summarizeMonth(history, [wallet], [], "2026-09");
    expect(summary.spent).toBe(0);
    expect(summary.income).toBe(0);
    const s = computeFinanceState(dataset({ accounts: [wallet], transactions: history, receivables: [receivable] }), TODAY);
    expect(s.balances.get(wallet.id)).toBe(P(5500));
    expect(s.stillToCollect).toBe(P(4500));
    expect(s.netWorth.netWorth).toBe(P(10000));
  });
});

describe("upcoming money moves and payday", () => {
  it("gathers bills, automations, card due dates, loans and money coming back", () => {
    const card = account({ type: "credit", name: "RCBC Visa", dueDay: 18, openingBalance: -P(6300) });
    const wallet = account();
    const loan = debt({ name: "Home Credit phone", minimumPayment: P(1500), nextDueDate: "2026-09-25" });
    const moves = upcomingMoneyMoves({
      today: TODAY,
      days: 30,
      bills: [bill({ name: "Globe postpaid", amount: P(999), nextDueDate: "2026-09-17" })],
      recurring: [recurring({ accountId: wallet.id, name: "Bedspace rental", amount: P(4500), nextDate: "2026-09-25", anchorDay: 25, frequency: "monthly" })],
      accounts: [card, wallet],
      balances: new Map([[card.id, -P(6300)]]),
      debtProgress: [{ debt: loan, remaining: P(7500), paid: 0, percent: 0, paidThisMonth: 0, monthsToPayoff: 5, payoffDate: null, minimumMetThisMonth: false }],
      receivables: [],
    });
    expect(moves.income.map((m) => [m.label, m.daysLeft])).toEqual([["Bedspace rental", 11]]);
    expect(moves.expenses.map((m) => [m.label, m.daysLeft, m.amount])).toEqual([
      ["Globe postpaid", 3, P(999)],
      ["RCBC Visa due", 4, P(6300)],
      ["Home Credit phone payment", 11, P(1500)],
    ]);
  });

  it("clamps due days to short months", () => {
    expect(nextDayOfMonth("2026-02-10", 31)).toBe("2026-02-28");
    expect(nextDayOfMonth("2026-02-28", 30)).toBe("2026-02-28");
    expect(nextDayOfMonth("2026-12-20", 5)).toBe("2027-01-05");
  });

  it("knows days until payday and the expected amount", () => {
    const salary = recurring({ accountId: "a", amount: P(18500), nextDate: "2026-09-23" });
    expect(computePayday({ frequency: "monthly", paydays: [30] }, [salary], [], TODAY)).toMatchObject({ date: "2026-09-23", daysLeft: 9, expectedAmount: P(18500), basis: "automation" });
    const past = [tx({ type: "income", amount: P(15000), accountId: "a", categoryId: "cat_salary", date: "2026-08-30" })];
    expect(computePayday({ frequency: "semimonthly", paydays: [15, 31] }, [], past, TODAY)).toMatchObject({ date: "2026-09-15", daysLeft: 1, expectedAmount: P(15000), basis: "last-payday" });
  });
});

describe("talking to Owwy", () => {
  const bdo = account({ name: "BDO" });
  const bpi = account({ name: "BPI Savings", type: "savings" });
  const gcash = account({ name: "GCash", type: "ewallet" });
  const ctx = { categories: DEFAULT_CATEGORIES, accounts: [bdo, bpi, gcash], today: TODAY, currency: "PHP" as const };

  it("understands transfers phrased naturally", () => {
    expect(parseSmartInput("Transfer 40k from my BDO account to my BPI savings account", ctx)).toMatchObject({
      type: "transfer",
      amount: P(40000),
      accountId: bdo.id,
      toAccountId: bpi.id,
      needs: [],
    });
  });

  it("reads merchants, accounts and relative dates", () => {
    expect(parseSmartInput("Spent 220 on Starbucks from my GCash account", ctx)).toMatchObject({ amount: P(220), categoryId: "cat_food", accountId: gcash.id, description: "Starbucks" });
    expect(parseSmartInput("Paid 3,421 for my electric bill last Friday", ctx)).toMatchObject({ amount: P(3421), categoryId: "cat_utilities", date: "2026-09-11" });
    expect(parseSmartInput("Salary 15000", ctx)).toMatchObject({ type: "income", categoryId: "cat_salary", amount: P(15000) });
  });

  it("matches a logged payment to its bill", () => {
    const bills = [bill({ id: "b1", name: "Electricity" }), bill({ id: "b2", name: "Converge internet" })];
    expect(matchBill("electric bill", bills)?.id).toBe("b1");
    expect(matchBill("converge", bills)?.id).toBe("b2");
    expect(matchBill("groceries", bills)).toBeUndefined();
  });

  it("stages a bill payment linked to the bill", () => {
    const data = dataset({ accounts: [bdo, gcash], bills: [bill({ id: "bill_e", name: "Electricity", accountId: bdo.id })] });
    const s = computeFinanceState(data, TODAY);
    const reply = answerLocally("Paid 3,421 for my electric bill last Friday", { data, state: s, today: TODAY, currency: "PHP", brief: true });
    const staged = reply.blocks.find((b) => b.type === "staged") as Extract<ChatBlock, { type: "staged" }>;
    expect(staged.drafts[0]).toMatchObject({ billId: "bill_e", amount: P(3421), accountId: bdo.id, date: "2026-09-11" });
  });
});

describe("saving staged entries", () => {
  let n = 0;
  beforeEach(async () => {
    setDB(new OwwyDB(`owwy-staged-${++n}`));
    await initializeApp(TODAY);
  });
  afterEach(async () => {
    const db = getDB();
    db.close();
    await db.delete();
    setDB(null);
  });

  it("pays the matched bill, and Cancel restores everything", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(10000) });
    const electricity = await createBill({ name: "Electricity", emoji: "💡", amount: P(2100), categoryId: "cat_utilities", frequency: "monthly", nextDueDate: "2026-09-15", accountId: wallet.id });
    const drafts = [
      { key: "1", type: "expense" as const, amount: P(3421), accountId: wallet.id, categoryId: "cat_utilities", date: "2026-09-11", note: "Electricity", tags: [], billId: electricity.id },
      { key: "2", type: "expense" as const, amount: P(220), accountId: wallet.id, categoryId: "cat_food", date: TODAY, note: "Starbucks", tags: [] },
    ];
    const { savedIds, previousBills } = await saveStagedDrafts(drafts);
    expect(savedIds).toHaveLength(2);
    expect((await getDB().bills.get(electricity.id))!.nextDueDate).toBe("2026-10-15");
    const balance = async () => computeBalances(await getDB().accounts.toArray(), await getDB().transactions.toArray()).get(wallet.id);
    expect(await balance()).toBe(P(10000 - 3421 - 220));

    await undoStagedSave(savedIds, previousBills);
    expect(await balance()).toBe(P(10000));
    expect((await getDB().bills.get(electricity.id))!.nextDueDate).toBe("2026-09-15");
  });

  it("rolls back everything if one entry can't be saved", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: 0 });
    const drafts = [
      { key: "1", type: "expense" as const, amount: P(100), accountId: wallet.id, categoryId: "cat_food", date: TODAY, note: "", tags: [] },
      { key: "2", type: "expense" as const, amount: P(100), accountId: "missing-account", categoryId: "cat_food", date: TODAY, note: "", tags: [] },
    ];
    await expect(saveStagedDrafts(drafts)).rejects.toThrow();
    expect(await getDB().transactions.count()).toBe(0);
  });
});
