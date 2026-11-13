import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeBalances } from "@/lib/finance/balances";
import { computeReceivableProgress, totalStillToCollect } from "@/lib/finance/receivables";
import { checkSplit, customShares, evenShares } from "@/lib/finance/split";
import { summarizePeriod } from "@/lib/finance/summary";
import { initializeApp } from "@/lib/services/app";
import { saveSplitBill, undoSplitBill } from "@/lib/services/split";
import { getDB, loadDataset, OwwyDB, setDB } from "@/lib/storage/db";
import { createAccount } from "@/lib/storage/repositories/accounts";

describe("evenShares", () => {
  it("includes you and spreads the odd centavos", () => {
    const shares = evenShares(100_01, ["Migs", "Ana"]);
    expect(shares).toHaveLength(3);
    expect(shares[0].isYou).toBe(true);
    expect(shares.reduce((t, s) => t + s.amount, 0)).toBe(100_01);
  });

  it("handles a split with one other person", () => {
    expect(evenShares(2_400_00, ["Migs"]).map((s) => s.amount)).toEqual([1_200_00, 1_200_00]);
  });
});

describe("customShares", () => {
  it("leaves the remainder as your share", () => {
    const shares = customShares(2_400_00, [{ person: "Migs", amount: 900_00 }, { person: "Ana", amount: 700_00 }]);
    expect(shares[0]).toMatchObject({ isYou: true, amount: 800_00 });
  });
});

describe("checkSplit", () => {
  const ok = evenShares(900_00, ["Migs", "Ana"]);

  it("accepts a complete split", () => {
    expect(checkSplit(900_00, ok)).toMatchObject({ valid: true, yours: 300_00, owed: 600_00 });
  });

  it.each([
    [0, ok, "Enter the total you paid."],
    [900_00, evenShares(900_00, []), "Add at least one person to split with."],
    [900_00, evenShares(900_00, ["  "]), "Give everyone a name."],
    [900_00, customShares(900_00, [{ person: "Migs", amount: 1_000_00 }]), "Their shares add up to more than the total."],
  ])("rejects: %s", (total, shares, problem) => {
    expect(checkSplit(total, shares)).toMatchObject({ valid: false, problem });
  });
});

describe("saveSplitBill", () => {
  const TODAY = "2026-09-28";
  let dbCount = 0;
  let accountId = "";

  beforeEach(async () => {
    setDB(new OwwyDB(`owwy-split-test-${++dbCount}`));
    await initializeApp(TODAY);
    const account = await createAccount({ name: "Main", type: "bank", openingBalance: 10_000_00 });
    accountId = account.id;
  });

  afterEach(async () => {
    const db = getDB();
    db.close();
    await db.delete();
    setDB(null);
  });

  const dinner = () => ({
    description: "Dinner",
    date: TODAY,
    accountId,
    categoryId: "cat_food",
    yourShare: 800_00,
    others: [
      { person: "Migs", amount: 800_00 },
      { person: "Ana", amount: 800_00 },
    ],
  });

  it("takes the whole bill from the account but only counts your share as spending", async () => {
    await saveSplitBill(dinner());
    const data = await loadDataset();

    const balance = computeBalances(data.accounts, data.transactions).get(accountId);
    expect(balance).toBe(10_000_00 - 2_400_00);

    const month = summarizePeriod(data.transactions, data.accounts, data.goals, "2026-09-01", "2026-09-30");
    expect(month.spent).toBe(800_00);
  });

  it("turns everyone else's share into money owed to you", async () => {
    await saveSplitBill(dinner());
    const data = await loadDataset();

    expect(data.receivables.map((r) => r.person).sort()).toEqual(["Ana", "Migs"]);
    const progress = data.receivables.map((r) => computeReceivableProgress(r, data.transactions, "2026-09-28"));
    expect(totalStillToCollect(progress)).toBe(1_600_00);
    expect(data.receivables.every((r) => r.note === "Dinner")).toBe(true);
  });

  it("undoes cleanly, leaving no trace", async () => {
    const result = await saveSplitBill(dinner());
    await undoSplitBill(result);
    const data = await loadDataset();

    expect(data.transactions).toHaveLength(0);
    expect(data.receivables).toHaveLength(0);
    expect(computeBalances(data.accounts, data.transactions).get(accountId)).toBe(10_000_00);
  });

  it("refuses a split with nobody in it", async () => {
    await expect(saveSplitBill({ ...dinner(), others: [] })).rejects.toThrow(/at least one person/i);
  });

  it("works when you paid but owe nothing yourself", async () => {
    await saveSplitBill({ ...dinner(), yourShare: 0 });
    const data = await loadDataset();
    const month = summarizePeriod(data.transactions, data.accounts, data.goals, "2026-09-01", "2026-09-30");
    expect(month.spent).toBe(0);
    expect(computeBalances(data.accounts, data.transactions).get(accountId)).toBe(10_000_00 - 1_600_00);
  });
});

