import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { guessReceiptCategory, sameMerchant } from "@/lib/receipts/categorize";
import { findMerchant, findReceiptDate, parseReceipt, parseReceiptAmount } from "@/lib/receipts/parse-receipt";
import type { Transaction } from "@/types/models";

const categories = DEFAULT_CATEGORIES;
const TODAY = "2026-09-25";

const GROCERY_RECEIPT = `
PUREGOLD PRICE CLUB INC.
Ayala Ave cor Buendia
TIN 003-838-000-0000 VAT REG
OFFICIAL RECEIPT

09/24/2026  14:32
Rice 5kg          289.00
Eggs tray         210.50
Milk 1L            98.75
Dishwashing soap   64.00
SUBTOTAL          662.25
VAT 12%            79.47
TOTAL             741.72
CASH            1,000.00
CHANGE            258.28
Thank you for shopping!
`;

const CAFE_RECEIPT = `
STARBUCKS COFFEE
Bonifacio High Street

Sep 20, 2026 09:12 AM
1 Caffe Latte Grande   195.00
1 Blueberry Muffin     145.00
Sub Total              340.00
GRAND TOTAL            340.00
Cash                   500.00
`;

/**
 * Real Tesseract output from a photo of a 20-item receipt — tilted, unevenly
 * lit, shot at arm's length. The ragged column gaps are what the engine
 * actually produces, and they are load-bearing: they separate an item from its
 * price. Never tidy this up.
 */
const PHONE_PHOTO_TEXT = `PUREGOLD PRICE CLUB INC.
Ayala Ave cor Buendia
TIN 003-838-000-0000 VAT REG
OFFICIAL RECEIPT

09/24/2026 14:32

Rice 5kg                                              17.00

Eggs tray                                                   30.07

Milk 1L                                                     43.14
Cooking oil                                            5.42
Detergent bar  2                                 84.33
SUBTOTAL                                          662.25
VAT 12%                                              79.47
TOTAL                                            741.72
CASH                                           1,000.00
CHANGE                                           258.28
TOTAL ITEMS                                           20
TOTAL SAVINGS                                         120.00

Thank you for shopping!
`;

const tx = (over: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(36), type: "expense", amount: 50000, accountId: "a1", date: "2026-09-01", note: "", tags: [], createdAt: 0, updatedAt: 0, ...over }) as Transaction;

describe("parseReceiptAmount", () => {
  it.each([
    ["1,234.00", 123400],
    ["P 89.50", 8950],
    ["₱1 234,00", 123400],
    ["741.72", 74172],
    ["1000", 100000],
    ["l20.00", 12000],
  ])("reads %s", (raw, expected) => {
    expect(parseReceiptAmount(raw, "PHP")).toBe(expected);
  });

  it("ignores text and absurd numbers", () => {
    expect(parseReceiptAmount("thank you", "PHP")).toBeNull();
    expect(parseReceiptAmount("TIN 003-838-000-0000", "PHP")).toBeNull();
  });

  it("refuses two numbers that happen to sit side by side", () => {
    // A space groups thousands only alongside a comma decimal ("1 234,00").
    // "2 180.00" is a quantity beside a price and must not become ₱2,180.
    expect(parseReceiptAmount("2 180.00", "PHP")).toBeNull();
    expect(parseReceiptAmount("1,234.00 1,500.00", "PHP")).toBeNull();
  });

  it("respects currencies without decimals", () => {
    expect(parseReceiptAmount("1,250", "JPY")).toBe(1250);
  });
});

describe("parseReceipt", () => {
  it("reads the shop, the total, the date and the items from a grocery receipt", () => {
    const receipt = parseReceipt(GROCERY_RECEIPT, { currency: "PHP", today: TODAY });
    expect(receipt.merchant).toBe("Puregold Price Club INC.");
    expect(receipt.total).toBe(74172);
    expect(receipt.date).toBe("2026-09-24");
    expect(receipt.items.map((i) => i.amount)).toEqual([28900, 21050, 9875, 6400]);
    expect(receipt.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("never mistakes subtotal, VAT, cash or change for the total", () => {
    const receipt = parseReceipt(GROCERY_RECEIPT, { currency: "PHP", today: TODAY });
    expect(receipt.total).not.toBe(66225);
    expect(receipt.total).not.toBe(100000);
    expect(receipt.items.some((i) => /vat|cash|change|subtotal/i.test(i.label))).toBe(false);
  });

  it("prefers a grand total and reads a written date", () => {
    const receipt = parseReceipt(CAFE_RECEIPT, { currency: "PHP", today: TODAY });
    expect(receipt.total).toBe(34000);
    expect(receipt.date).toBe("2026-09-20");
    expect(receipt.merchant).toBe("Starbucks Coffee");
  });

  it("falls back to the largest amount when nothing says total", () => {
    const receipt = parseReceipt("TINY SARI SARI\nLoad card 100.00\nCandy 15.00", { currency: "PHP", today: TODAY });
    expect(receipt.total).toBe(10000);
    expect(receipt.confidence).toBeLessThan(0.8);
  });

  it("survives text that isn't a receipt", () => {
    const receipt = parseReceipt("just some words", { currency: "PHP", today: TODAY });
    expect(receipt.total).toBeNull();
    expect(receipt.confidence).toBeLessThan(0.5);
  });
});

describe("parseReceipt on a real photo", () => {
  const receipt = parseReceipt(PHONE_PHOTO_TEXT, { currency: "PHP", today: TODAY });

  it("reads the amount actually paid", () => {
    expect(receipt.total).toBe(74172);
    expect(receipt.totalLine).toBe("total 741.72");
  });

  it("is not fooled by the summary lines printed under the total", () => {
    // "TOTAL ITEMS 20" and "TOTAL SAVINGS 120.00" both carry the word total and
    // come last, so the wrong rule picks them and the scan reads ₱20 or ₱120.
    expect(receipt.total).not.toBe(2000);
    expect(receipt.total).not.toBe(12000);
  });

  it("keeps the price when a quantity shares the line", () => {
    // "Detergent bar  2      84.33" is one item at 84.33, not 284.33.
    const detergent = receipt.items.find((i) => i.label.startsWith("Detergent"));
    expect(detergent?.amount).toBe(8433);
  });

  it("still finds the shop and the date", () => {
    expect(receipt.merchant).toBe("Puregold Price Club INC.");
    expect(receipt.date).toBe("2026-09-24");
  });
});

describe("choosing the total", () => {
  const total = (text: string) => parseReceipt(text, { currency: "PHP", today: TODAY }).total;

  it("takes the total, not the cash handed over, when OCR joins the lines", () => {
    expect(total("SHOP\nTOTAL 1,234.00 CASH 1,500.00")).toBe(123400);
  });

  it("reads a total that is qualified rather than replaced", () => {
    expect(total("SHOP\nTOTAL (VAT INCLUSIVE) 1,234.00")).toBe(123400);
    expect(total("SHOP\nAMOUNT DUE INCL VAT 980.00")).toBe(98000);
  });

  it("flags a total that is smaller than a line it should contain", () => {
    // A misread "TOTAL 41.72" cannot be the sum of a 289.00 and a 210.50 line.
    // Owwy still shows it — it's the only thing labelled total — but says so.
    const receipt = parseReceipt("SHOP\nRice 289.00\nEggs 210.50\nTOTAL 41.72", { currency: "PHP", today: TODAY });
    expect(receipt.totalLooksOff).toBe(true);
    expect(receipt.confidence).toBeLessThan(0.6);
  });

  it("does not flag a total that adds up", () => {
    const receipt = parseReceipt(PHONE_PHOTO_TEXT, { currency: "PHP", today: TODAY });
    expect(receipt.totalLooksOff).toBe(false);
  });

  it("prefers a believable total over a doubtful one with stronger wording", () => {
    // "AMOUNT DUE" outranks "TOTAL", but 9.00 can't be the total here.
    expect(total("SHOP\nRice 289.00\nEggs 210.50\nTOTAL 499.50\nAMOUNT DUE 9.00")).toBe(49950);
  });

  it("prefers the first of two equally worded totals", () => {
    expect(total("SHOP\nRice 289.00\nTOTAL 741.72\nTOTAL 12.00")).toBe(74172);
  });

  it("keeps ignoring subtotal, VAT, cash and change", () => {
    expect(total("SHOP\nSUBTOTAL 662.25\nVAT 79.47\nTOTAL 741.72\nCASH 1,000.00\nCHANGE 258.28")).toBe(74172);
  });
});

describe("findReceiptDate", () => {
  it("ignores future and ancient dates", () => {
    expect(findReceiptDate(["12/31/2031"], TODAY)).toBeNull();
    expect(findReceiptDate(["01/02/2019"], TODAY)).toBeNull();
  });

  it("reads day-first dates when the day is above 12", () => {
    expect(findReceiptDate(["24/09/2026"], TODAY)).toBe("2026-09-24");
  });
});

describe("findMerchant", () => {
  it("skips receipt boilerplate and addresses", () => {
    expect(findMerchant(["OFFICIAL RECEIPT", "TIN 003-838-000", "SM SUPERMARKET", "Makati"])).toBe("SM Supermarket");
  });
});

describe("guessReceiptCategory", () => {
  it("uses how you filed the same shop before", () => {
    const receipt = parseReceipt(GROCERY_RECEIPT, { currency: "PHP", today: TODAY });
    const guess = guessReceiptCategory(receipt, {
      categories,
      transactions: [tx({ note: "Puregold", categoryId: "cat_shopping" }), tx({ note: "Puregold weekly run", categoryId: "cat_shopping" })],
    });
    expect(guess).toMatchObject({ categoryId: "cat_shopping", reason: "history" });
    expect(guess.confidence).toBeGreaterThan(0.9);
    expect(guess.detail).toContain("2 times");
  });

  it("recognizes the shop by name when there's no history", () => {
    const receipt = parseReceipt(CAFE_RECEIPT, { currency: "PHP", today: TODAY });
    const guess = guessReceiptCategory(receipt, { categories, transactions: [] });
    expect(guess).toMatchObject({ categoryId: "cat_food", reason: "merchant" });
    expect(guess.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("falls back to what's printed on the receipt", () => {
    const receipt = parseReceipt("ZENITH CORNER\n\nVitamins 120.00\nMedicine 95.00\nTOTAL 215.00", { currency: "PHP", today: TODAY });
    const guess = guessReceiptCategory(receipt, { categories, transactions: [] });
    expect(guess).toMatchObject({ categoryId: "cat_health", reason: "items" });
    expect(guess.detail).toContain("Vitamins");
  });

  it("admits when it has no idea", () => {
    const guess = guessReceiptCategory({ merchant: "Zzyxx Ltd", items: [] }, { categories, transactions: [] });
    expect(guess).toMatchObject({ categoryId: null, confidence: 0, reason: null });
  });

  it("matches shops without being fooled by generic words", () => {
    expect(sameMerchant("Puregold", "PUREGOLD PRICE CLUB INC.")).toBe(true);
    expect(sameMerchant("Corner store", "Family Store")).toBe(false);
    expect(sameMerchant("", "Puregold")).toBe(false);
  });
});

