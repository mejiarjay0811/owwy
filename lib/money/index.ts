import type { CurrencyCode, Minor } from "@/types/models";
import { getCurrency, minorFactor } from "./currency";

export { CURRENCIES, CURRENCY_LIST, getCurrency, minorFactor } from "./currency";
export type { CurrencyInfo } from "./currency";
export { accountCurrency, approximateRate, convertMinor, rateToBase, toBase, type FxContext } from "./fx";

/** Converts a major-unit number (e.g. 180.5) to integer minor units (18050). */
export function toMinor(major: number, code: CurrencyCode): Minor {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * minorFactor(code));
}

/** Converts integer minor units to a major-unit number. */
export function toMajor(minor: Minor, code: CurrencyCode): number {
  return minor / minorFactor(code);
}

/**
 * Parses user-typed amounts: "1,240", "₱1,240.50", "1.2k", "30k", "2m".
 * Returns minor units, or null when the text contains no usable amount.
 */
export function parseAmount(input: string, code: CurrencyCode): Minor | null {
  const cleaned = input.trim().toLowerCase().replace(/[₱$€£¥\s]|php|usd|eur|gbp|sgd|aud|cad|jpy/g, "");
  const match = cleaned.match(/^(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?([km])?$/);
  if (!match || (!match[1] && !match[2])) return null;
  const whole = (match[1] ?? "0").replace(/,/g, "");
  let value = Number(whole + (match[2] ?? ""));
  if (match[3] === "k") value *= 1_000;
  if (match[3] === "m") value *= 1_000_000;
  if (!Number.isFinite(value) || value < 0) return null;
  return toMinor(value, code);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(code: CurrencyCode, decimals: number, compact: boolean): Intl.NumberFormat {
  const key = `${code}:${decimals}:${compact}`;
  let f = formatterCache.get(key);
  if (!f) {
    const info = getCurrency(code);
    f = new Intl.NumberFormat(info.locale, {
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
      notation: compact ? "compact" : "standard",
    });
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatMoneyOptions {
  /** Show "+" for positive values. */
  signed?: boolean;
  /** Drop ".00" when the amount is whole. */
  trimZeros?: boolean;
  /** 12.4K style for tight spaces. */
  compact?: boolean;
  /** Omit the currency symbol. */
  noSymbol?: boolean;
  /** Round down to whole units — for estimates like Safe-to-Spend where centavos are noise. */
  whole?: boolean;
}

/**
 * Formats minor units with the currency's own symbol. The symbol is placed
 * explicitly so "₱" renders as "₱1,240" in every locale (Intl sometimes emits "PHP").
 */
export function formatMoney(minor: Minor, code: CurrencyCode, options: FormatMoneyOptions = {}): string {
  const info = getCurrency(code);
  const exact = Math.abs(minor) / minorFactor(code);
  const major = options.whole ? Math.floor(exact) : exact;
  const isWhole = Number.isInteger(major);
  const decimals = (options.trimZeros || options.whole) && isWhole ? 0 : info.decimals;
  const body = formatter(code, decimals, Boolean(options.compact)).format(major);
  const symbol = options.noSymbol ? "" : info.symbol;
  const sign = minor < 0 ? "−" : options.signed && minor > 0 ? "+" : "";
  return `${sign}${symbol}${body}`;
}

/** Plain editable string for inputs: 1240.5 → "1240.50". */
export function minorToInput(minor: Minor, code: CurrencyCode): string {
  const decimals = getCurrency(code).decimals;
  const major = minor / minorFactor(code);
  return decimals === 0 ? String(Math.round(major)) : major.toFixed(decimals).replace(/\.00$/, "");
}

/** Sums minor-unit values safely. */
export function sum(values: readonly Minor[]): Minor {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Percent of `part` in `whole`, safe for zero. */
export function percentOf(part: Minor, whole: Minor): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

/** Splits an amount into `n` near-equal integer parts that add back to the total. */
export function splitEvenly(total: Minor, n: number): Minor[] {
  if (n <= 0) return [];
  const base = Math.trunc(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < Math.abs(remainder) ? Math.sign(remainder) : 0));
}
