import type { Category, CurrencyCode, ISODate, Transaction } from "@/types/models";
import { guessReceiptCategory, type CategoryGuess } from "./categorize";
import { readReceiptText, type ScanProgress } from "./ocr";
import { parseReceipt, type ParsedReceipt } from "./parse-receipt";

export type { CategoryGuess } from "./categorize";
export type { ScanProgress } from "./ocr";
export type { ParsedReceipt, ReceiptItem } from "./parse-receipt";
export { readReceiptText, releaseScanner, scanningSupported } from "./ocr";
export { readPriceTag, type PriceTagReading } from "./price-tag";
export { parseReceipt } from "./parse-receipt";
export { guessReceiptCategory } from "./categorize";

export interface ReceiptScan extends ParsedReceipt {
  guess: CategoryGuess;
}

export interface ScanContext {
  categories: readonly Category[];
  transactions: readonly Transaction[];
  currency: CurrencyCode;
  today: ISODate;
}

/** Reads a receipt photo and works out the shop, the total, the date and the category. */
export async function scanReceipt(file: Blob, ctx: ScanContext, onProgress?: (progress: ScanProgress) => void): Promise<ReceiptScan> {
  const text = await readReceiptText(file, onProgress);
  const receipt = parseReceipt(text, { currency: ctx.currency, today: ctx.today });
  return { ...receipt, guess: guessReceiptCategory(receipt, ctx) };
}
