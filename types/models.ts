/**
 * Owwy domain model.
 *
 * Conventions
 * - Money is always stored as integer minor units (e.g. centavos) to avoid
 *   floating-point drift. Use `lib/money` helpers to convert and format.
 * - Calendar dates are local `YYYY-MM-DD` strings (`ISODate`), months are `YYYY-MM`.
 * - Account balances are never stored; they are derived from the opening balance
 *   plus transactions, so every screen always agrees.
 */

export type ID = string;
/** Local calendar date, `YYYY-MM-DD`. */
export type ISODate = string;
/** Calendar month, `YYYY-MM`. */
export type MonthKey = string;
/** Integer amount in the currency's minor unit. */
export type Minor = number;

export type CurrencyCode = "PHP" | "USD" | "EUR" | "GBP" | "SGD" | "AUD" | "CAD" | "JPY";

/** "timeOfDay" follows the clock: light through the day, dark in the evening. */
export type ThemePreference = "light" | "dark" | "system" | "timeOfDay";

export type AccountType =
  | "cash"
  | "bank"
  | "savings"
  | "ewallet"
  | "credit"
  | "emergency"
  | "investment"
  | "other";

export type CardPattern = "none" | "feathers" | "waves" | "dots";

export interface Account {
  id: ID;
  name: string;
  type: AccountType;
  /** Balance when the account was added to Owwy. Negative for money owed. */
  openingBalance: Minor;
  /** Card gradient preset id (see `lib/defaults/card-styles`). */
  cardStyle: string;
  cardPattern: CardPattern;
  /** Optional last 4 digits, shown only as a recognition hint. */
  last4?: string;
  /** Credit limit for credit accounts. */
  creditLimit?: Minor;
  /** Whether this money counts as spendable in Safe-to-Spend. */
  includeInSafeToSpend: boolean;
  /** Annual interest rate in percent (e.g. 0.0625). Interest posts itself monthly. */
  interestRate?: number;
  /** Withholding tax on interest in percent (e.g. 20 in the Philippines). */
  interestTaxRate?: number;
  /** Last month (`YYYY-MM`) interest was posted for. */
  interestPostedThrough?: MonthKey;
  /**
   * Currency this account is kept in. Omitted = the app's main currency.
   * Totals convert foreign balances with the user's own exchange rates.
   */
  currency?: CurrencyCode;
  /** Credit cards: day of the month the statement payment is due (1–31). */
  dueDay?: number;
  archived: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export type CategoryKind = "expense" | "income";

export interface Category {
  id: ID;
  name: string;
  emoji: string;
  /** Hex color used in charts. */
  color: string;
  kind: CategoryKind;
  /** Discretionary categories are the first place Owwy suggests trimming. */
  discretionary: boolean;
  /** Words that map smart input like "coffee 180" to this category. */
  keywords: string[];
  isDefault: boolean;
  archived: boolean;
  order: number;
}

export type TransactionType = "expense" | "income" | "transfer";

export interface Transaction {
  id: ID;
  type: TransactionType;
  /** Always positive, in the currency of `accountId`; direction comes from `type`. */
  amount: Minor;
  /** Source account (expense/transfer) or receiving account (income). */
  accountId: ID;
  /** Destination for transfers. */
  toAccountId?: ID;
  /** Amount received, in the destination account's currency (cross-currency transfers only). */
  toAmount?: Minor;
  /** Lending money out or collecting it back. Not counted as spending or income. */
  receivableId?: ID;
  categoryId?: ID;
  date: ISODate;
  /** Optional local time, `HH:MM`. */
  time?: string;
  note: string;
  tags: string[];
  billId?: ID;
  goalId?: ID;
  debtId?: ID;
  recurringId?: ID;
  createdAt: number;
  updatedAt: number;
}

export type BudgetMonth = MonthKey;

export interface Budget {
  id: ID;
  categoryId: ID;
  month: BudgetMonth;
  amount: Minor;
  paused: boolean;
  /**
   * What this budget is actually for, when the category alone doesn't say.
   * A catch-all like "Other" becomes "Other · Pet supplies"; shown in place
   * of the category name wherever the budget is listed.
   */
  label?: string;
  createdAt: number;
}

/**
 * `monthDays` repeats on chosen days of the month — the 15th and 30th of a
 * Philippine semi-monthly payday, say, or the 1st, 10th and 20th. The days
 * live on the rule as `monthDays`; 31 always means "last day", so February
 * lands on the 28th rather than skipping.
 */
export type Frequency = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "monthDays" | "quarterly" | "yearly";

/** 31 means "last day of the month", whatever that month's length is. */
export const LAST_DAY_OF_MONTH = 31;

export interface Bill {
  id: ID;
  name: string;
  emoji: string;
  amount: Minor;
  categoryId: ID;
  /** Account the bill is usually paid from. */
  accountId?: ID;
  frequency: Frequency;
  /** Next unpaid due date. Advances when the bill is paid or skipped. */
  nextDueDate: ISODate;
  /** Anchor day-of-month so Feb→Mar doesn't drift from the 31st to the 28th. */
  anchorDay: number;
  remindDaysBefore: number;
  lastPaidDate?: ISODate;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SavingsGoal {
  id: ID;
  name: string;
  emoji: string;
  targetAmount: Minor;
  /** Amount already saved before tracking in Owwy. */
  startingAmount: Minor;
  targetDate?: ISODate;
  /** Account where this goal's money is kept. */
  accountId: ID;
  color: string;
  completedAt?: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DebtKind = "credit_card" | "personal_loan" | "borrowed" | "installment" | "other";

export interface Debt {
  id: ID;
  name: string;
  kind: DebtKind;
  /** Amount owed when tracking started. */
  startingBalance: Minor;
  /** Original principal, used for payoff progress. */
  originalAmount: Minor;
  minimumPayment: Minor;
  nextDueDate?: ISODate;
  anchorDay?: number;
  /** Annual interest rate in percent, informational. */
  interestRate?: number;
  /** Linked credit account: remaining balance comes from that account. */
  accountId?: ID;
  lender?: string;
  /** Installment plans only: how many monthly payments the plan runs for. */
  termMonths?: number;
  /** Installment plans only: the month the first payment was due. */
  startedOn?: ISODate;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RecurringTransaction {
  id: ID;
  name: string;
  type: TransactionType;
  amount: Minor;
  accountId: ID;
  toAccountId?: ID;
  categoryId?: ID;
  note: string;
  frequency: Exclude<Frequency, "once">;
  startDate: ISODate;
  /** Next occurrence that has not been posted yet. */
  nextDate: ISODate;
  anchorDay: number;
  /** Days of the month for `frequency: "monthDays"`. Sorted, 1–31, 31 = last day. */
  monthDays?: number[];
  endDate?: ISODate;
  /** "auto" logs on its date without asking; "confirm" waits for a tap. */
  mode: AutomationMode;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AutomationMode = "auto" | "confirm";

/** Money someone owes you. */
export interface Receivable {
  id: ID;
  person: string;
  note: string;
  /** Amount originally owed to you. */
  originalAmount: Minor;
  /** Already collected before tracking in Owwy. */
  startingCollected: Minor;
  dueDate?: ISODate;
  /** Set when fully collected or written off. */
  closedAt?: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** One line on a shopping trip: what you picked up and what it cost. */
export interface ShoppingItem {
  id: ID;
  label: string;
  /** Unit price. */
  price: Minor;
  quantity: number;
  /** In the trolley, or still just on the list. */
  inCart: boolean;
  /** The price came from scanning a shelf tag rather than being typed. */
  scanned?: boolean;
  createdAt: number;
}

export type ShoppingTripStatus = "active" | "done" | "abandoned";

/**
 * A shopping trip: a budget for one visit, the items as they go in the
 * trolley, and the single expense it becomes when you're done.
 */
export interface ShoppingTrip {
  id: ID;
  name: string;
  /** 0 means "no budget, just keep a running total". */
  budget: Minor;
  categoryId: ID;
  accountId?: ID;
  items: ShoppingItem[];
  status: ShoppingTripStatus;
  startedAt: number;
  closedAt?: number;
  /** The expense created when the trip was finished. */
  transactionId?: ID;
  updatedAt: number;
}

export interface MoneyNote {
  id: ID;
  text: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A receipt photo attached to a transaction. Device-only binary data. */
export interface Attachment {
  id: ID;
  transactionId: ID;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  createdAt: number;
}

/** Automatic daily backup kept on this device. */
export interface LocalBackup {
  /** `YYYY-MM-DD` */
  id: ISODate;
  createdAt: number;
  size: number;
  transactionCount: number;
  data: string;
}

export interface MonthlySnapshot {
  /** `YYYY-MM` */
  id: MonthKey;
  generatedAt: number;
  seen: boolean;
  income: Minor;
  spent: Minor;
  saved: Minor;
}

export type PayFrequency = "monthly" | "semimonthly" | "biweekly" | "weekly" | "irregular";

export type MainGoal = "save" | "control" | "debt" | "understand" | "other";

export type DashboardWidgetId =
  | "grove"
  | "pending"
  | "safeToSpend"
  | "payday"
  | "spending"
  | "accounts"
  | "thisMonth"
  | "upcoming"
  | "budgets"
  | "goals"
  | "recent";

export interface DashboardWidget {
  id: DashboardWidgetId;
  visible: boolean;
}

export type BufferMode = "percent" | "fixed";

export interface SafeToSpendSettings {
  bufferMode: BufferMode;
  /** Percent (0–50) of remaining money kept aside, when `bufferMode` is "percent". */
  bufferPercent: number;
  /** Fixed cushion when `bufferMode` is "fixed". */
  bufferAmount: Minor;
  /** Balance the user never wants to drop below. */
  minimumBalance: Minor;
  /** Monthly savings target reserved before spending. 0 = use goal suggestions. */
  monthlySavingsTarget: Minor;
  useGoalSuggestions: boolean;
}

export interface IncomeSchedule {
  frequency: PayFrequency;
  /** Days of month for monthly (1 value) or semimonthly (2 values). 31 = last day. */
  paydays: number[];
  /** Reference payday for weekly/biweekly schedules. */
  anchorDate?: ISODate;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  pinIterations?: number;
  pinLength?: number;
  /** Minutes in background before locking. 0 = immediately. */
  autoLockMinutes: number;
  biometricEnabled: boolean;
}

export type AssistantProvider = "local" | "anthropic";

export interface AssistantSettings {
  /** "local" answers on this device; "anthropic" uses the user's own Claude API key. */
  provider: AssistantProvider;
  model: string;
  /** Short answers by default. */
  brief: boolean;
  /** Whether transaction notes may be included in what's sent to the AI. */
  shareNotes: boolean;
  /** Log clear entries immediately (with Undo) instead of asking to review first. */
  autoLog: boolean;
}

/** Units of the main currency per 1 unit of each other currency. */
export type ExchangeRates = Partial<Record<CurrencyCode, number>>;

export interface AppSettings {
  id: "app";
  schemaVersion: number;
  onboarded: boolean;
  /** The first-run guided tour has been seen (or skipped). Replayable from More. */
  tourSeen?: boolean;
  displayName: string;
  currency: CurrencyCode;
  locale: string;
  theme: ThemePreference;
  hideBalances: boolean;
  weekStartsOn: 0 | 1;
  mainGoal: MainGoal;
  income: IncomeSchedule;
  safeToSpend: SafeToSpendSettings;
  security: SecuritySettings;
  assistant: AssistantSettings;
  dashboard: DashboardWidget[];
  showNetWorth: boolean;
  billReminders: boolean;
  exchangeRates: ExchangeRates;
  /** When exchange rates were last edited. */
  exchangeRatesUpdatedAt?: number;
  /** Keep a copy of everything on this device once a day. */
  autoBackup: boolean;
  /** True while the sample data set is loaded. */
  demoMode: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ Assistant */

export interface StagedTransaction {
  key: string;
  type: TransactionType;
  amount: Minor;
  accountId?: ID;
  toAccountId?: ID;
  categoryId?: ID;
  date: ISODate;
  note: string;
  tags: string[];
  /** Paying this bill: saving also moves the bill to its next due date. */
  billId?: ID;
}

export type ChatBlock =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | {
      type: "query";
      title: string;
      /** Human-readable description of exactly what was computed. */
      query: string;
      columns: string[];
      rows: (string | number)[][];
      rowCount: number;
    }
  | {
      type: "staged";
      drafts: StagedTransaction[];
      status: "pending" | "saved" | "dismissed" | "cancelled";
      savedIds?: ID[];
      /** Bill states before payment, so Cancel can restore them. */
      previousBills?: Bill[];
      /** Logged instantly (auto-log) rather than after review. */
      auto?: boolean;
    }
  | { type: "suggestions"; items: string[] }
  | { type: "error"; text: string };

export interface ChatMessage {
  id: ID;
  role: "user" | "assistant";
  blocks: ChatBlock[];
  /** "On device" or the model that answered. */
  source?: string;
  createdAt: number;
}

/** Everything Owwy stores, used for backup/export and calculations. */
export interface OwwyDataset {
  settings: AppSettings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  bills: Bill[];
  goals: SavingsGoal[];
  debts: Debt[];
  recurring: RecurringTransaction[];
  snapshots: MonthlySnapshot[];
  receivables: Receivable[];
  notes: MoneyNote[];
  trips: ShoppingTrip[];
}
