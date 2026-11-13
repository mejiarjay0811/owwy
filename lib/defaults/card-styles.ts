import type { AccountType, CardPattern } from "@/types/models";

export interface CardStyle {
  id: string;
  name: string;
  /** CSS background for the card face. */
  background: string;
  /** Soft glow used for the card's shadow. */
  glow: string;
  /** "light" means dark text on a light card. */
  tone: "dark" | "light";
}

/**
 * Owwy's own card finishes, named after the owl's world — dusk, forest, feathers.
 * Deliberately unlike any real bank or e-wallet card.
 */
export const CARD_STYLES: CardStyle[] = [
  {
    id: "evergreen",
    name: "Evergreen",
    background: "radial-gradient(120% 140% at 100% 0%, #2c6b61 0%, #14463f 45%, #0a2a26 100%)",
    glow: "rgba(20, 70, 63, 0.45)",
    tone: "dark",
  },
  {
    id: "amber",
    name: "Amber Eye",
    background: "radial-gradient(120% 140% at 0% 0%, #f7c46c 0%, #e39a35 48%, #b8661c 100%)",
    glow: "rgba(227, 154, 53, 0.45)",
    tone: "dark",
  },
  {
    id: "dusk",
    name: "Dusk",
    background: "radial-gradient(130% 140% at 100% 100%, #8a5a8c 0%, #4a3561 45%, #221b3a 100%)",
    glow: "rgba(74, 53, 97, 0.45)",
    tone: "dark",
  },
  {
    id: "moss",
    name: "Moss",
    background: "radial-gradient(120% 140% at 100% 0%, #9bb35e 0%, #5f7d34 50%, #36501f 100%)",
    glow: "rgba(95, 125, 52, 0.4)",
    tone: "dark",
  },
  {
    id: "clay",
    name: "Clay",
    background: "radial-gradient(120% 140% at 0% 100%, #e48b6a 0%, #c0573f 50%, #7e3326 100%)",
    glow: "rgba(192, 87, 63, 0.4)",
    tone: "dark",
  },
  {
    id: "midnight",
    name: "Midnight",
    background: "radial-gradient(120% 140% at 100% 0%, #34506b 0%, #1a2b3c 50%, #0a131c 100%)",
    glow: "rgba(26, 43, 60, 0.5)",
    tone: "dark",
  },
  {
    id: "lagoon",
    name: "Lagoon",
    background: "radial-gradient(120% 140% at 0% 0%, #7fd1c3 0%, #2f9c94 48%, #1b6068 100%)",
    glow: "rgba(47, 156, 148, 0.4)",
    tone: "dark",
  },
  {
    id: "plum",
    name: "Plum Blossom",
    background: "radial-gradient(120% 140% at 100% 0%, #f0a6b4 0%, #c26a85 50%, #7d3a57 100%)",
    glow: "rgba(194, 106, 133, 0.4)",
    tone: "dark",
  },
  {
    id: "graphite",
    name: "Graphite",
    background: "radial-gradient(120% 140% at 100% 0%, #5a6066 0%, #30353a 50%, #16191c 100%)",
    glow: "rgba(48, 53, 58, 0.45)",
    tone: "dark",
  },
  {
    id: "parchment",
    name: "Parchment",
    background: "radial-gradient(120% 140% at 0% 0%, #fffaf0 0%, #f1e7d4 50%, #dccbad 100%)",
    glow: "rgba(170, 145, 100, 0.35)",
    tone: "light",
  },
];

export function getCardStyle(id: string): CardStyle {
  return CARD_STYLES.find((s) => s.id === id) ?? CARD_STYLES[0];
}

export const CARD_PATTERNS: { id: CardPattern; name: string }[] = [
  { id: "feathers", name: "Feathers" },
  { id: "waves", name: "Waves" },
  { id: "dots", name: "Stars" },
  { id: "none", name: "Plain" },
];

export interface AccountTypeInfo {
  type: AccountType;
  label: string;
  emoji: string;
  defaultStyle: string;
  /** Spendable by default in Safe-to-Spend. */
  spendable: boolean;
  /** Counts as savings for "saved this month". */
  savings: boolean;
  liability: boolean;
  hint: string;
}

export const ACCOUNT_TYPES: Record<AccountType, AccountTypeInfo> = {
  cash: { type: "cash", label: "Cash", emoji: "💵", defaultStyle: "moss", spendable: true, savings: false, liability: false, hint: "Money in your wallet" },
  bank: { type: "bank", label: "Bank account", emoji: "🏦", defaultStyle: "evergreen", spendable: true, savings: false, liability: false, hint: "Everyday checking or payroll" },
  ewallet: { type: "ewallet", label: "E-wallet", emoji: "📱", defaultStyle: "lagoon", spendable: true, savings: false, liability: false, hint: "Mobile wallet balance" },
  savings: { type: "savings", label: "Savings", emoji: "🐷", defaultStyle: "amber", spendable: false, savings: true, liability: false, hint: "Money you're setting aside" },
  emergency: { type: "emergency", label: "Emergency fund", emoji: "🛟", defaultStyle: "midnight", spendable: false, savings: true, liability: false, hint: "For the unexpected" },
  credit: { type: "credit", label: "Credit card", emoji: "💳", defaultStyle: "graphite", spendable: false, savings: false, liability: true, hint: "Tracks what you owe" },
  investment: { type: "investment", label: "Investments", emoji: "📈", defaultStyle: "dusk", spendable: false, savings: true, liability: false, hint: "Long-term money, value only" },
  other: { type: "other", label: "Other", emoji: "👛", defaultStyle: "parchment", spendable: true, savings: false, liability: false, hint: "Anything else" },
};

export const ACCOUNT_TYPE_LIST = Object.values(ACCOUNT_TYPES);
