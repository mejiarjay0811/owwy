import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { computeFinanceState } from "@/lib/finance/state";
import { initializeApp } from "@/lib/services/app";
import { listLocalBackups, restoreLocalBackup, runDailyBackup } from "@/lib/services/auto-backup";
import { exportDataset, parseBackup, serializeBackup, transactionsToCSV } from "@/lib/services/backup";
import { applyCsvImport, parseCSV, parseDate, planCsvImport } from "@/lib/services/csv-import";
import { getDB, loadDataset, OwwyDB, setDB } from "@/lib/storage/db";
import { createAccount } from "@/lib/storage/repositories/accounts";
import { createNote, deleteNote, updateNote } from "@/lib/storage/repositories/notes";
import { createReceivable, recordCollection } from "@/lib/storage/repositories/receivables";
import { updateSettings, withDefaults } from "@/lib/storage/repositories/settings";
import { addTransaction } from "@/lib/storage/repositories/transactions";
import { account, P, tx } from "./fixtures";

const TODAY = "2026-09-14";

describe("CSV parsing", () => {
  it("handles quotes, commas, newlines and a BOM", () => {
    expect(parseCSV('﻿Date,Note,Amount\r\n2026-09-01,"Lunch, with ""team""",180\n2026-09-02,"Two\nlines",50')).toEqual([
      ["Date", "Note", "Amount"],
      ["2026-09-01", 'Lunch, with "team"', "180"],
      ["2026-09-02", "Two\nlines", "50"],
    ]);
  });

  it("reads common date formats", () => {
    expect(parseDate("2026-09-14")).toBe("2026-09-14");
    expect(parseDate("09/14/2026")).toBe("2026-09-14");
    expect(parseDate("14/09/2026")).toBe("2026-09-14");
    expect(parseDate("2026/02/30")).toBeNull();
    expect(parseDate("nonsense")).toBeNull();
  });

  it("plans an import: categories, new accounts, signs, duplicates and errors", () => {
    const cash = account({ name: "Cash" });
    const csv = [
      "Date,Type,Amount,Category,Account,To account,Note,Tags",
      "2026-09-01,expense,-180.00,Food,Cash,,Lunch,work",
      "2026-09-02,,30000,Salary,BDO,,Payroll,",
      "2026-09-03,,-250,Mystery,Cash,,Something,",
      "2026-09-04,transfer,1000,,BDO,Cash,ATM,",
      "not a date,expense,10,Food,Cash,,Bad,",
      "2026-09-05,expense,-99,Food,Cash,,Already here,",
    ].join("\n");
    const plan = planCsvImport(csv, {
      accounts: [cash],
      categories: DEFAULT_CATEGORIES,
      transactions: [tx({ type: "expense", amount: P(99), accountId: cash.id, note: "Already here", date: "2026-09-05" })],
      currency: "PHP",
      today: TODAY,
    });
    expect(plan.valid).toBe(4);
    expect(plan.duplicates).toBe(1);
    expect(plan.errors).toBe(1);
    expect(plan.newAccounts).toEqual(["BDO"]);
    expect(plan.uncategorized).toBe(1);
    const inputs = plan.rows.filter((r) => r.input).map((r) => r.input!);
    expect(inputs.map((i) => [i.type, i.amount, i.categoryId])).toEqual([
      ["expense", P(180), "cat_food"],
      ["income", P(30000), "cat_salary"],
      ["expense", P(250), "cat_other"],
      ["transfer", P(1000), undefined],
    ]);
  });

  it("reports missing required columns", () => {
    expect(planCsvImport("Note,Category\nLunch,Food", { accounts: [], categories: DEFAULT_CATEGORIES, transactions: [], currency: "PHP", today: TODAY }).missingColumns).toEqual(["Date", "Amount"]);
  });
});

describe("with a device database", () => {
  let n = 0;
  beforeEach(async () => {
    setDB(new OwwyDB(`owwy-data-tools-${++n}`));
    await initializeApp(TODAY);
    await updateSettings({ onboarded: true });
  });
  afterEach(async () => {
    const db = getDB();
    db.close();
    await db.delete();
    setDB(null);
  });

  const state = async () => {
    const raw = await loadDataset();
    return computeFinanceState({ ...raw, settings: withDefaults(raw.settings ?? {}) }, TODAY);
  };

  it("round-trips Owwy's own CSV export", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: 0 });
    await addTransaction({ type: "expense", amount: P(180), accountId: wallet.id, categoryId: "cat_food", date: TODAY, note: "Lunch, with team" });
    const csv = transactionsToCSV(await exportDataset());
    await getDB().transactions.clear();
    const s = await state();
    const plan = planCsvImport(csv, { accounts: s.accounts, categories: s.categories, transactions: [], currency: "PHP", today: TODAY });
    expect(plan.valid).toBe(1);
    expect(await applyCsvImport(plan)).toBe(1);
    const after = await state();
    expect(after.transactions[0]).toMatchObject({ note: "Lunch, with team", amount: P(180), categoryId: "cat_food", accountId: wallet.id });
  });

  it("lends money and collects it back without touching spending", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(10000) });
    const r = await createReceivable({ person: "Migs", amount: P(6000), lentFromAccountId: wallet.id, date: TODAY, dueDate: "2026-10-01" });
    await recordCollection({ receivableId: r.id, accountId: wallet.id, amount: P(2000), date: TODAY });
    let s = await state();
    expect(s.balances.get(wallet.id)).toBe(P(6000));
    expect(s.thisMonth.spent).toBe(0);
    expect(s.stillToCollect).toBe(P(4000));
    await expect(recordCollection({ receivableId: r.id, accountId: wallet.id, amount: P(5000), date: TODAY })).rejects.toThrow(/more than/);
    const done = await recordCollection({ receivableId: r.id, accountId: wallet.id, amount: P(4000), date: TODAY });
    expect(done.fullyCollected).toBe(true);
    s = await state();
    expect(s.receivableProgress[0].status).toBe("collected");
  });

  it("keeps notes and includes them, and receivables, in backups", async () => {
    const note = await createNote("Check the mobile plan in December");
    await updateNote(note.id, { pinned: true });
    await createReceivable({ person: "Ana", amount: P(500), date: TODAY });
    const parsed = await parseBackup(serializeBackup(await exportDataset()));
    expect(parsed.data.notes[0]).toMatchObject({ pinned: true });
    expect(parsed.data.receivables).toHaveLength(1);
    await deleteNote(note.id);
    expect(await getDB().notes.count()).toBe(0);
    await expect(createNote("   ")).rejects.toThrow(/Write something/);
  });

  it("makes one local backup per day, keeps a week, and restores", async () => {
    const wallet = await createAccount({ name: "Wallet", type: "bank", openingBalance: P(100) });
    await addTransaction({ type: "expense", amount: P(10), accountId: wallet.id, categoryId: "cat_food", date: TODAY });
    expect(await runDailyBackup(TODAY)).not.toBeNull();
    expect(await runDailyBackup(TODAY)).toBeNull();
    for (let d = 1; d <= 9; d++) await runDailyBackup(`2026-10-0${d}`);
    const backups = await listLocalBackups();
    expect(backups).toHaveLength(7);
    expect(backups[0]).not.toHaveProperty("data");

    await getDB().transactions.clear();
    await restoreLocalBackup(backups[0].id);
    expect((await state()).balances.get(wallet.id)).toBe(P(90));
  });
});
