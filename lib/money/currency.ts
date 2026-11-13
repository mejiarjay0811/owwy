import type { CurrencyCode } from "@/types/models";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** Number of minor-unit digits (JPY has none). */
  decimals: number;
  /** Locale used for grouping and symbol placement. */
  locale: string;
  flag: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  PHP: { code: "PHP", symbol: "₱", name: "Philippine Peso", decimals: 2, locale: "en-PH", flag: "🇵🇭" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, locale: "en-US", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2, locale: "en-IE", flag: "🇪🇺" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, locale: "en-GB", flag: "🇬🇧" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2, locale: "en-SG", flag: "🇸🇬" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2, locale: "en-AU", flag: "🇦🇺" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2, locale: "en-CA", flag: "🇨🇦" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0, locale: "ja-JP", flag: "🇯🇵" },
};

export const CURRENCY_LIST: CurrencyInfo[] = Object.values(CURRENCIES);

export function getCurrency(code: CurrencyCode): CurrencyInfo {
  return CURRENCIES[code] ?? CURRENCIES.PHP;
}

export function minorFactor(code: CurrencyCode): number {
  return 10 ** getCurrency(code).decimals;
}
