import { getCurrency } from "@/lib/money/currency";
import type { CurrencyCode, Minor } from "@/types/models";
import { amountsOn } from "./parse-receipt";

/** Things printed near a price that are never the price itself. */
const NOISE = /barcode|code|sku|item\s*no|per\s*(kg|g|l|ml|pc|piece)|\bkg\b|\bml\b|\bpcs?\b|\bg\b|\bl\b|valid|until|exp|\d{8,}/i;

export interface PriceTagReading {
  price: Minor | null;
  /** Other plausible prices on the tag, largest first. */
  alternatives: Minor[];
  /** The shop or product line, when the tag has one. */
  label: string | null;
}

/**
 * Reads a shelf tag. The price is printed largest, but OCR gives no font
 * sizes, so Owwy takes the biggest plausible amount and offers the rest as
 * alternatives — you confirm before anything is added.
 */
export function readPriceTag(text: string, currency: CurrencyCode): PriceTagReading {
  const decimals = getCurrency(currency).decimals;
  // Column gaps matter here too: "2 for  99.00" is a quantity and a price.
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]/g, " ").trim())
    .filter(Boolean);

  const prices: Minor[] = [];
  for (const line of lines) {
    if (NOISE.test(line)) continue;
    for (const amount of amountsOn(line, currency)) {
      // A shelf price is neither free nor six figures.
      if (amount < 1_000_000 * 10 ** decimals) prices.push(amount);
    }
  }

  const sorted = [...new Set(prices)].sort((a, b) => b - a);
  const label =
    lines
      .map((line) => line.replace(/\s+/g, " ").trim())
      .find((line) => {
        const letters = line.replace(/[^\p{L}]/gu, "").length;
        return letters >= 3 && letters / line.length > 0.5 && !NOISE.test(line);
      }) ?? null;

  return { price: sorted[0] ?? null, alternatives: sorted.slice(1, 4), label };
}
