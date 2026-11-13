import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeFinanceState } from "@/lib/finance/state";
import { initializeApp } from "@/lib/services/app";
import { createEncryptedBackup, exportDataset, parseBackup, PassphraseRequiredError, restoreBackup, serializeBackup, transactionsToCSV } from "@/lib/services/backup";
import { buildDemoDataset, clearFinancialData, loadDemoData } from "@/lib/services/demo";
import { checkPin, enablePin, lockoutSeconds } from "@/lib/services/security";
import { getDB, loadDataset, OwwyDB, setDB } from "@/lib/storage/db";
import { withDefaults } from "@/lib/storage/repositories/settings";
import { createAccount, deleteAccount } from "@/lib/storage/repositories/accounts";
import { createBill, payBill, undoBillPayment } from "@/lib/storage/repositories/bills";
import { setBudget, copyBudgetsFromPreviousMonth } from "@/lib/storage/repositories/budgets";
import { createDebt, recordDebtPayment } from "@/lib/storage/repositories/debts";
import { contributeToGoal, createGoal } from "@/lib/storage/repositories/goals";
import { confirmAutomation, createRecurring, runRecurringRules, skipAutomation } from "@/lib/storage/repositories/recurring";
import { postInterest } from "@/lib/services/interest";
import { updateSettings } from "@/lib/storage/repositories/settings";
import { addTransaction, deleteTransaction, restoreTransactions } from "@/lib/storage/repositories/transactions";
import { P } from "./fixtures";

const TODAY = "2026-09-14";
let dbCount = 0;

async function state() {
  const raw = await loadDataset();
  return computeFinanceState({ ...raw, settings: withDefaults(raw.settings ?? {}) }, TODAY);
}

beforeEach(async () => {
  setDB(new OwwyDB(`owwy-test-${++dbCount}`));
  await initializeApp(TODAY);
  await updateSettings({ onboarded: true, income: { frequency: "monthly", paydays: [1] }, safeToSpend: { bufferPercent: 0 } });
});

afterEach(async () => {
  const db = getDB();
  db.close();
  await db.delete();
  setDB(null);
});

describe("a ₱500 food expense flows everywhere", () => {
  it("updates balance, month spending, budget, safe-to-spend and history", async () => {
    const wallet = await createAccount({ name: "Main Wallet", type: "bank", openingBalance: P(8450) });
    await setBudget("cat_food", "2026-09", P(5000));
    const before = await state();
    expect(before.safeToSpend.amount).toBe(P(8450));

    await addTransaction({ type: "expense", amount: P(500), accountId: wallet.id, categoryId: "cat_food", date: TODAY, note: "Lunch" });
    const after = await state();
    expect(after.balances.get(wallet.id)).toBe(P(7950));
    expect(after.thisMonth.spent).toBe(P(500));
    expect(after.budgetProgress[0].spent).toBe(P(500));
    expect(after.safeToSpend.amount).toBe(P(7950));
    expect(after.spentToday).toBe(P(500));
    expect(after.transactions[0].note).toBe("Lunch");
  });

  it("supports delete with undo", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "cash", openingBalance: P(1000) });
    const t = await addTransaction({ type: "expense", amount: P(200), accountId: wallet.id, categoryId: "cat_food", date: TODAY });
    const deleted = await deleteTransaction(t.id);
    expect((await state()).balances.get(wallet.id)).toBe(P(1000));
    await restoreTransactions([deleted!]);
    expect((await state()).balances.get(wallet.id)).toBe(P(800));
  });

  it("rejects invalid transactions with clear messages", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "cash", openingBalance: 0 });
    await expect(addTransaction({ type: "expense", amount: 0, accountId: wallet.id, categoryId: "cat_food", date: TODAY })).rejects.toThrow(/greater than zero/);
    await expect(addTransaction({ type: "expense", amount: P(5), accountId: wallet.id, categoryId: "cat_salary", date: TODAY })).rejects.toThrow(/expense category/);
    await expect(addTransaction({ type: "transfer", amount: P(5), accountId: wallet.id, toAccountId: wallet.id, date: TODAY })).rejects.toThrow(/different accounts/);
  });
});

describe("goals, bills and debts", () => {
  it("a ₱2,000 goal contribution moves money and counts as saved", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(10000) });
    const savings = await createAccount({ name: "Savings", type: "savings", openingBalance: P(5000) });
    const g = await createGoal({ name: "Laptop", emoji: "💻", targetAmount: P(10000), accountId: savings.id, color: "#E8A33D" });

    await contributeToGoal({ goalId: g.id, accountId: wallet.id, amount: P(2000), date: TODAY });
    const s = await state();
    expect(s.balances.get(wallet.id)).toBe(P(8000));
    expect(s.balances.get(savings.id)).toBe(P(7000));
    expect(s.goalProgress[0].saved).toBe(P(2000));
    expect(s.thisMonth.saved).toBe(P(2000));
    expect(s.totals.totalBalance).toBe(P(15000));
    await expect(contributeToGoal({ goalId: g.id, accountId: savings.id, amount: P(1), date: TODAY })).rejects.toThrow(/different account/);
  });

  it("paying a bill records the expense and advances the due date, with undo", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(5000) });
    const b = await createBill({ name: "Electricity", emoji: "💡", amount: P(2100), categoryId: "cat_utilities", frequency: "monthly", nextDueDate: "2026-09-15", accountId: wallet.id });

    expect((await state()).safeToSpend.lines.find((l) => l.key === "bills")!.amount).toBe(P(2100));
    const result = await payBill(b.id, { accountId: wallet.id, date: TODAY });
    const s = await state();
    expect(s.balances.get(wallet.id)).toBe(P(2900));
    expect(result.updated.nextDueDate).toBe("2026-10-15");
    // Next due date is beyond the 30-day upcoming window.
    expect(s.upcomingBills.find((o) => o.bill.id === b.id)).toBeUndefined();
    // Paid bill is no longer reserved; the money already left the account.
    expect(s.safeToSpend.amount).toBe(P(2900));

    await undoBillPayment(result);
    const undone = await state();
    expect(undone.balances.get(wallet.id)).toBe(P(5000));
    expect((await getDB().bills.get(b.id))!.nextDueDate).toBe("2026-09-15");
  });

  it("credit card payments reduce what's owed and advance the due date", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(10000) });
    const card = await createAccount({ name: "Card", type: "credit", openingBalance: P(4820) });
    const d = await createDebt({ name: "Card", kind: "credit_card", startingBalance: P(4820), minimumPayment: P(1000), nextDueDate: "2026-09-10", accountId: card.id });
    expect((await state()).debtProgress[0].remaining).toBe(P(4820));

    await recordDebtPayment({ debtId: d.id, fromAccountId: wallet.id, amount: P(1500), date: TODAY });
    const s = await state();
    expect(s.debtProgress[0].remaining).toBe(P(3320));
    expect(s.balances.get(wallet.id)).toBe(P(8500));
    expect((await getDB().debts.get(d.id))!.nextDueDate).toBe("2026-10-10");
    expect(s.totals.owed).toBe(P(3320));
  });

  it("won't delete accounts with history", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: 0 });
    await addTransaction({ type: "income", amount: P(100), accountId: wallet.id, categoryId: "cat_salary", date: TODAY });
    await expect(deleteAccount(wallet.id)).rejects.toThrow(/Archive/);
  });
});

describe("recurring and budgets", () => {
  it("posts missed recurring items exactly once", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: 0 });
    await createRecurring({ name: "Salary", type: "income", amount: P(15000), accountId: wallet.id, categoryId: "cat_salary", frequency: "monthly", startDate: "2026-08-15" });
    expect(await runRecurringRules(TODAY)).toBe(1);
    expect(await runRecurringRules(TODAY)).toBe(0);
    expect(await runRecurringRules("2026-09-15")).toBe(1);
    expect((await state()).balances.get(wallet.id)).toBe(P(30000));
  });

  it("copies last month's budgets", async () => {
    await setBudget("cat_food", "2026-08", P(5000));
    await setBudget("cat_transport", "2026-08", P(3000));
    await setBudget("cat_food", "2026-09", P(6000));
    expect(await copyBudgetsFromPreviousMonth("2026-09")).toBe(1);
    const budgets = await getDB().budgets.where("month").equals("2026-09").toArray();
    expect(budgets.map((b) => [b.categoryId, b.amount]).sort()).toEqual([["cat_food", P(6000)], ["cat_transport", P(3000)]]);
  });
});

describe("automations and interest", () => {
  it("waits for confirmation on ask-first automations, then logs or skips", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(5000) });
    const rule = await createRecurring({ name: "Internet", type: "expense", amount: P(1899), accountId: wallet.id, categoryId: "cat_utilities", frequency: "monthly", startDate: "2026-09-12", mode: "confirm" });
    expect(await runRecurringRules(TODAY)).toBe(0);

    const { transaction } = await confirmAutomation(rule.id);
    expect(transaction.date).toBe("2026-09-12");
    expect((await state()).balances.get(wallet.id)).toBe(P(3101));
    expect((await getDB().recurring.get(rule.id))!.nextDate).toBe("2026-10-12");

    const skipped = await skipAutomation(rule.id);
    expect(skipped.nextDate).toBe("2026-10-12");
    expect((await getDB().recurring.get(rule.id))!.nextDate).toBe("2026-11-12");
  });

  it("posts after-tax interest once per completed month", async () => {
    const savings = await createAccount({ name: "Savings", type: "savings", openingBalance: P(12000), interestRate: 12, interestTaxRate: 20 });
    // Pretend interest was switched on two months earlier.
    await getDB().accounts.update(savings.id, { interestPostedThrough: "2026-06" });
    expect(await postInterest(TODAY)).toBe(2);
    expect(await postInterest(TODAY)).toBe(0);
    const s = await state();
    // Jul: 120 gross → 96 net; Aug: on 12,096 → 120.96 gross → 96.77 net
    expect(s.balances.get(savings.id)).toBe(P(12000) + 9600 + 9677);
    expect(s.transactions.filter((t) => t.categoryId === "cat_interest")).toHaveLength(2);
  });
});

describe("backup, demo and security", () => {
  it("round-trips a backup and strips the app lock", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(1234) });
    await addTransaction({ type: "expense", amount: P(99), accountId: wallet.id, categoryId: "cat_food", date: TODAY, note: "=cmd" });
    await enablePin("1234");

    const data = await exportDataset();
    const text = serializeBackup(data);
    expect(text).not.toContain(data.settings.security.pinHash!);

    const parsed = await parseBackup(text);
    expect(parsed.counts.transactions).toBe(1);
    await clearFinancialData();
    expect((await state()).accounts).toHaveLength(0);
    await restoreBackup(parsed.data);
    expect((await state()).balances.get(wallet.id)).toBe(P(1135));
    // This device keeps its own lock.
    expect(await checkPin("1234")).toBe(true);
    expect(await checkPin("9999")).toBe(false);

    const csv = transactionsToCSV(parsed.data);
    expect(csv.split("\r\n")[1]).toBe(`${TODAY},expense,-99.00,PHP,Food,Wallet,,'=cmd,`);
  });

  it("encrypts backups with a passphrase", async () => {
    await createAccount({ name: "Wallet", type: "bank", openingBalance: P(50) });
    const encrypted = await createEncryptedBackup(await exportDataset(), "correct horse");
    expect(encrypted).not.toContain("Wallet");
    await expect(parseBackup(encrypted)).rejects.toBeInstanceOf(PassphraseRequiredError);
    await expect(parseBackup(encrypted, "wrong pass")).rejects.toThrow(/passphrase/);
    expect((await parseBackup(encrypted, "correct horse")).counts.accounts).toBe(1);
  });

  it("rejects damaged backups without touching data", async () => {
    await createAccount({ name: "Wallet", type: "bank", openingBalance: P(50) });
    const data = await exportDataset();
    const broken = JSON.parse(serializeBackup(data));
    broken.data.accounts[0].openingBalance = "lots";
    await expect(parseBackup(JSON.stringify(broken))).rejects.toThrow(/damaged/);
    await expect(parseBackup("not json")).rejects.toThrow(/isn't an Owwy backup/);
    expect((await state()).accounts).toHaveLength(1);
  });

  it("builds demo data with friendly balances that pass validation", async () => {
    const demo = buildDemoDataset(TODAY);
    await loadDemoData(TODAY);
    await initializeApp(TODAY);
    const s = await state();
    expect(s.balances.get("acc_demo_main")).toBe(P(8450));
    expect(s.balances.get("acc_demo_savings")).toBe(P(25000));
    expect(s.totals.owed).toBe(P(4820));
    expect(s.thisMonth.income).toBe(P(30000));
    expect(s.safeToSpend.nextIncomeDate).toBe("2026-10-01");
    expect(s.upcomingBills[0].bill.name).toBe("Electricity");
    // Recurring rules must not re-post demo history.
    expect(s.transactions.length).toBe(demo.transactions.length);
    expect(s.balances.get("acc_demo_usd")).toBe(42000); // $420.00 kept in dollars
    expect(s.multiCurrency).toBe(true);
    expect(s.stillToCollect).toBe(P(4500));
    const parsed = await parseBackup(serializeBackup(await exportDataset()));
    expect(parsed.counts.accounts).toBe(7);
  });

  it("escalates PIN lockouts", () => {
    expect(lockoutSeconds(4)).toBe(0);
    expect(lockoutSeconds(5)).toBe(30);
    expect(lockoutSeconds(8)).toBe(60);
    expect(lockoutSeconds(100)).toBe(900);
  });
});
