import {
  ArrowLeftRight,
  CalendarDays,
  ChartPie,
  CreditCard,
  HandCoins,
  House,
  Landmark,
  NotebookPen,
  MessageCircle,
  PiggyBank,
  Receipt,
  Repeat,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export const SIDEBAR_PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/ask/", label: "Ask Owwy", icon: MessageCircle },
  { href: "/transactions/", label: "Log", icon: ArrowLeftRight },
  { href: "/budgets/", label: "Budgets", icon: Target },
  { href: "/goals/", label: "Goals", icon: PiggyBank },
  { href: "/bills/", label: "Bills", icon: Receipt },
  { href: "/calendar/", label: "Calendar", icon: CalendarDays },
  { href: "/insights/", label: "Stats", icon: ChartPie },
  { href: "/accounts/", label: "Accounts", icon: Wallet },
];

export const SIDEBAR_SECONDARY: NavItem[] = [
  { href: "/safe-to-spend/", label: "Safe to spend", icon: ShieldCheck },
  { href: "/afford/", label: "Can I afford it?", icon: Scale },
  { href: "/debts/", label: "Debts", icon: CreditCard },
  { href: "/owed/", label: "Owed to you", icon: HandCoins },
  { href: "/recurring/", label: "Automations", icon: Repeat },
  { href: "/shopping/", label: "Shopping trip", icon: ShoppingCart },
  { href: "/notes/", label: "Notes", icon: NotebookPen },
];

export const MORE_ITEMS: NavItem[] = [
  { href: "/transactions/", label: "Log", icon: ArrowLeftRight, description: "Search everything you've spent and received" },
  { href: "/shopping/", label: "Shopping trip", icon: ShoppingCart, description: "Budget a shop and watch the trolley" },
  { href: "/goals/", label: "Savings goals", icon: PiggyBank, description: "What you're saving for" },
  { href: "/accounts/", label: "Accounts", icon: Wallet, description: "Cards, balances, net worth" },
  { href: "/budgets/", label: "Budgets", icon: Target, description: "Limits for each category" },
  { href: "/bills/", label: "Bills", icon: Receipt, description: "What's due and what's paid" },
  { href: "/calendar/", label: "Money calendar", icon: CalendarDays, description: "Cash flow day by day" },
  { href: "/debts/", label: "Debts", icon: CreditCard, description: "Pay down what you owe" },
  { href: "/owed/", label: "Owed to you", icon: HandCoins, description: "Money friends and family still owe you" },
  { href: "/notes/", label: "Money notes", icon: NotebookPen, description: "Reminders and budgeting thoughts" },
  { href: "/recurring/", label: "Automations", icon: Repeat, description: "Salary, savings, rent — without being asked" },
  { href: "/safe-to-spend/", label: "Safe to spend", icon: ShieldCheck, description: "How your number is worked out" },
  { href: "/afford/", label: "Can I afford it?", icon: Scale, description: "Check a purchase first" },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings/", label: "Settings", icon: Settings };
export const NET_WORTH_ICON = Landmark;

export function isActive(pathname: string, href: string): boolean {
  const clean = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);
  const path = clean(pathname);
  const target = clean(href);
  return target === "/" ? path === "/" : path === target || path.startsWith(`${target}/`);
}
