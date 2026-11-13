import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { frequentItems, itemsToPutBack, lastPaidPrice, tripProgress, tripStatusLine } from "@/lib/finance/shopping";
import { readPriceTag } from "@/lib/receipts/price-tag";
import { initializeApp } from "@/lib/services/app";
import { getDB, loadDataset, OwwyDB, setDB } from "@/lib/storage/db";
import { createAccount } from "@/lib/storage/repositories/accounts";
import { addItem, finishTrip, startTrip, undoFinishTrip, updateItem } from "@/lib/storage/repositories/trips";
import { computeBalances } from "@/lib/finance/balances";
import { summarizePeriod } from "@/lib/finance/summary";
import type { ShoppingItem, ShoppingTrip } from "@/types/models";

const item = (over: Partial<ShoppingItem>): ShoppingItem => ({
  id: Math.random().toString(36),
  label: "Rice",
  price: 289_00,
  quantity: 1,
  inCart: true,
  createdAt: 1,
  ...over,
});

const trip = (over: Partial<ShoppingTrip>): ShoppingTrip =>
  ({ id: "t1", name: "Grocery run", budget: 0, categoryId: "cat_groceries", items: [], status: "done", startedAt: 0, updatedAt: 0, ...over }) as ShoppingTrip;

describe("tripProgress", () => {
  it("counts the trolley, not the list", () => {
    const p = tripProgress({ budget: 1_000_00, items: [item({ price: 300_00 }), item({ price: 200_00, inCart: false })] });
    expect(p).toMatchObject({ total: 300_00, pending: 200_00, projected: 500_00, left: 700_00, over: false, cartCount: 1, itemCount: 2 });
  });

  it("multiplies by quantity", () => {
    expect(tripProgress({ budget: 0, items: [item({ price: 50_00, quantity: 3 })] }).total).toBe(150_00);
  });

  it("knows when you're over, and when the list would take you over", () => {
    expect(tripProgress({ budget: 500_00, items: [item({ price: 600_00 })] })).toMatchObject({ over: true, left: -100_00 });
    expect(tripProgress({ budget: 500_00, items: [item({ price: 400_00 }), item({ price: 200_00, inCart: false })] })).toMatchObject({ over: false, willGoOver: true });
  });

  it("has no opinion without a budget", () => {
    expect(tripProgress({ budget: 0, items: [item({})] })).toMatchObject({ over: false, willGoOver: false, percent: 0 });
  });
});

describe("tripStatusLine", () => {
  const fmt = (v: number) => `P${(v / 100).toFixed(0)}`;

  it("says what matters at each stage", () => {
    expect(tripStatusLine(tripProgress({ budget: 1_000_00, items: [item({ price: 200_00 })] }), fmt)).toBe("P800 left to spend.");
    expect(tripStatusLine(tripProgress({ budget: 1_000_00, items: [item({ price: 900_00 })] }), fmt)).toBe("P100 left — getting close.");
    expect(tripStatusLine(tripProgress({ budget: 1_000_00, items: [item({ price: 1_200_00 })] }), fmt)).toBe("P200 over budget.");
    expect(tripStatusLine(tripProgress({ budget: 0, items: [] }), fmt)).toMatch(/No budget/);
  });
});

describe("itemsToPutBack", () => {
  it("suggests the fewest items that bring you back under", () => {
    const suggestion = itemsToPutBack({
      budget: 500_00,
      items: [item({ label: "Steak", price: 400_00 }), item({ label: "Rice", price: 200_00 }), item({ label: "Salt", price: 30_00 })],
    });
    expect(suggestion.map((i) => i.label)).toEqual(["Steak"]);
  });

  it("suggests nothing when you're within budget", () => {
    expect(itemsToPutBack({ budget: 500_00, items: [item({ price: 100_00 })] })).toEqual([]);
  });
});

describe("price memory", () => {
  const history = [
    trip({ id: "a", items: [item({ label: "Rice 5kg", price: 280_00, createdAt: 1 })] }),
    trip({ id: "b", items: [item({ label: "rice 5kg", price: 295_00, createdAt: 9 }), item({ label: "Eggs", price: 210_00, createdAt: 9 })] }),
    trip({ id: "c", status: "active", items: [item({ label: "Rice 5kg", price: 999_00, createdAt: 20 })] }),
  ];

  it("remembers the most recent price you actually paid", () => {
    expect(lastPaidPrice("Rice 5kg", history)).toBe(295_00);
    expect(lastPaidPrice("Caviar", history)).toBeNull();
  });

  it("ignores trips still in progress", () => {
    expect(lastPaidPrice("Rice 5kg", history)).not.toBe(999_00);
  });

  it("offers what you buy most often", () => {
    expect(frequentItems(history).map((f) => f.label)).toEqual(["Rice 5kg", "Eggs"]);
  });
});

describe("readPriceTag", () => {
  it("takes the largest plausible number as the price", () => {
    const reading = readPriceTag("FRESH MILK 1L\nSRP\n89.75\nbarcode 4800123456789", "PHP");
    expect(reading.price).toBe(89_75);
    expect(reading.label).toBe("FRESH MILK 1L");
  });

  it("offers the other numbers when it might have picked wrong", () => {
    const reading = readPriceTag("RICE 5KG\n289.00\n57.80", "PHP");
    expect(reading.price).toBe(289_00);
    expect(reading.alternatives).toContain(57_80);
  });

  it("ignores barcodes and per-unit lines", () => {
    const reading = readPriceTag("SUGAR 1KG\n4800987654321\nper kg 65.00\n72.50", "PHP");
    expect(reading.price).toBe(72_50);
  });

  it("gives nothing rather than guessing from an unreadable tag", () => {
    expect(readPriceTag("blurry", "PHP").price).toBeNull();
  });
});

describe("finishing a trip", () => {
  const TODAY = "2026-09-28";
  let dbCount = 0;
  let accountId = "";

  beforeEach(async () => {
    setDB(new OwwyDB(`owwy-trip-test-${++dbCount}`));
    await initializeApp(TODAY);
    accountId = (await createAccount({ name: "Main", type: "bank", openingBalance: 5_000_00 })).id;
  });

  afterEach(async () => {
    const db = getDB();
    db.close();
    await db.delete();
    setDB(null);
  });

  it("logs one expense for the whole trolley", async () => {
    const started = await startTrip({ name: "Grocery run", budget: 1_000_00, categoryId: "cat_groceries" });
    await addItem(started.id, { label: "Rice", price: 289_00 });
    await addItem(started.id, { label: "Eggs", price: 210_50, quantity: 2 });

    const result = await finishTrip({ tripId: started.id, accountId, date: TODAY });
    expect(result.amount).toBe(289_00 + 421_00);

    const data = await loadDataset();
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({ note: "Grocery run", categoryId: "cat_groceries", amount: 710_00 });
    expect(computeBalances(data.accounts, data.transactions).get(accountId)).toBe(5_000_00 - 710_00);
    expect(summarizePeriod(data.transactions, data.accounts, data.goals, "2026-09-01", "2026-09-30").spent).toBe(710_00);
  });

  it("leaves behind what never made it into the trolley", async () => {
    const started = await startTrip({ name: "Run", budget: 0, categoryId: "cat_groceries" });
    const withItems = await addItem(started.id, { label: "Rice", price: 289_00 });
    await addItem(started.id, { label: "Cake", price: 500_00 });
    await updateItem(started.id, withItems.items[0].id, { inCart: false });

    const result = await finishTrip({ tripId: started.id, accountId });
    expect(result.amount).toBe(500_00);
    expect(result.trip.items.map((i) => i.label)).toEqual(["Cake"]);
  });

  it("accepts a till total that differs from the trolley", async () => {
    const started = await startTrip({ name: "Run", budget: 0, categoryId: "cat_groceries" });
    await addItem(started.id, { label: "Rice", price: 289_00 });
    const result = await finishTrip({ tripId: started.id, accountId, amount: 275_00 });
    expect(result.amount).toBe(275_00);
  });

  it("refuses to log an empty trolley", async () => {
    const started = await startTrip({ name: "Run", budget: 0, categoryId: "cat_groceries" });
    await expect(finishTrip({ tripId: started.id, accountId })).rejects.toThrow(/trolley/i);
  });

  it("undoes back to an active trip with no expense left", async () => {
    const started = await startTrip({ name: "Run", budget: 0, categoryId: "cat_groceries" });
    await addItem(started.id, { label: "Rice", price: 289_00 });
    const result = await finishTrip({ tripId: started.id, accountId });
    await undoFinishTrip(result);

    const data = await loadDataset();
    expect(data.transactions).toHaveLength(0);
    expect(data.trips[0]).toMatchObject({ status: "active", transactionId: undefined });
    expect(computeBalances(data.accounts, data.transactions).get(accountId)).toBe(5_000_00);
  });
});
