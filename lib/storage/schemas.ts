import { z } from "zod";
import { isValidISODate } from "@/lib/dates";

/**
 * Runtime validation for everything written to storage or imported from a
 * backup. Types in `types/models.ts` stay the source of truth for the app;
 * these schemas guard the boundary.
 */

const id = z.string().min(1).max(64);
const isoDate = z.string().refine(isValidISODate, "Invalid date");
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month");
const minor = z.number().int();
const positiveMinor = minor.positive("Amount must be greater than zero");
const timestamp = z.number().int().nonnegative();
const name = z.string().trim().min(1, "Name is required").max(60, "Keep it under 60 characters");

export const currencySchema = z.enum(["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY"]);
export const frequencySchema = z.enum(["once", "daily", "weekly", "biweekly", "monthly", "monthDays", "quarterly", "yearly"]);

/** Chosen days of the month, 1–31 (31 = last day), de-duplicated and sorted. */
export const monthDaysSchema = z
  .array(z.number().int().min(1).max(31))
  .max(31)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

export const accountSchema = z.object({
  id,
  name,
  type: z.enum(["cash", "bank", "savings", "ewallet", "credit", "emergency", "investment", "other"]),
  openingBalance: minor,
  cardStyle: z.string().max(32),
  cardPattern: z.enum(["none", "feathers", "waves", "dots"]),
  last4: z.string().regex(/^\d{4}$/, "Use exactly 4 digits").optional(),
  creditLimit: minor.nonnegative().optional(),
  includeInSafeToSpend: z.boolean(),
  interestRate: z.number().min(0, "Interest can't be negative").max(100, "Enter an annual rate under 100%").optional(),
  interestTaxRate: z.number().min(0).max(100, "Tax must be between 0 and 100%").optional(),
  interestPostedThrough: monthKey.optional(),
  currency: z.enum(["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY"]).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  archived: z.boolean(),
  order: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const categorySchema = z.object({
  id,
  name,
  emoji: z.string().min(1).max(16),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(["expense", "income"]),
  discretionary: z.boolean(),
  keywords: z.array(z.string().max(40)).max(200),
  isDefault: z.boolean(),
  archived: z.boolean(),
  order: z.number().int(),
});

export const transactionSchema = z
  .object({
    id,
    type: z.enum(["expense", "income", "transfer"]),
    amount: positiveMinor,
    accountId: id,
    toAccountId: id.optional(),
    toAmount: positiveMinor.optional(),
    receivableId: id.optional(),
    categoryId: id.optional(),
    date: isoDate,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time").optional(),
    note: z.string().max(140, "Keep notes under 140 characters"),
    tags: z.array(z.string().max(30)).max(12),
    billId: id.optional(),
    goalId: id.optional(),
    debtId: id.optional(),
    recurringId: id.optional(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((tx) => tx.type !== "transfer" || (tx.toAccountId && tx.toAccountId !== tx.accountId), {
    message: "Choose two different accounts for a transfer",
    path: ["toAccountId"],
  });

export const budgetSchema = z.object({
  id,
  categoryId: id,
  month: monthKey,
  amount: positiveMinor,
  paused: z.boolean(),
  // Added after v4; budgets saved before this simply have none.
  label: z.string().trim().max(40, "Keep it under 40 characters").optional(),
  createdAt: timestamp,
});

export const billSchema = z.object({
  id,
  name,
  emoji: z.string().min(1).max(16),
  amount: positiveMinor,
  categoryId: id,
  accountId: id.optional(),
  frequency: frequencySchema,
  nextDueDate: isoDate,
  anchorDay: z.number().int().min(1).max(31),
  remindDaysBefore: z.number().int().min(0).max(14),
  lastPaidDate: isoDate.optional(),
  active: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const goalSchema = z.object({
  id,
  name,
  emoji: z.string().min(1).max(16),
  targetAmount: positiveMinor,
  startingAmount: minor.nonnegative(),
  targetDate: isoDate.optional(),
  accountId: id,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  completedAt: timestamp.optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const debtSchema = z.object({
  id,
  name,
  kind: z.enum(["credit_card", "personal_loan", "borrowed", "installment", "other"]),
  startingBalance: minor.nonnegative(),
  originalAmount: minor.nonnegative(),
  minimumPayment: minor.nonnegative(),
  nextDueDate: isoDate.optional(),
  anchorDay: z.number().int().min(1).max(31).optional(),
  interestRate: z.number().min(0).max(200).optional(),
  accountId: id.optional(),
  lender: z.string().max(60).optional(),
  // Installment plans (schema v4).
  termMonths: z.number().int().min(2, "A plan runs for at least 2 months").max(120).optional(),
  startedOn: isoDate.optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const recurringSchema = z
  .object({
    id,
    name,
    type: z.enum(["expense", "income", "transfer"]),
    amount: positiveMinor,
    accountId: id,
    toAccountId: id.optional(),
    categoryId: id.optional(),
    note: z.string().max(140),
    frequency: frequencySchema.exclude(["once"]),
    startDate: isoDate,
    nextDate: isoDate,
    anchorDay: z.number().int().min(1).max(31),
    monthDays: monthDaysSchema.optional(),
    endDate: isoDate.optional(),
    mode: z.enum(["auto", "confirm"]).default("auto"),
    active: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((r) => r.type !== "transfer" || (r.toAccountId && r.toAccountId !== r.accountId), {
    message: "Choose two different accounts for a transfer",
    path: ["toAccountId"],
  })
  .refine((r) => r.frequency !== "monthDays" || (r.monthDays?.length ?? 0) > 0, {
    message: "Pick at least one day of the month",
    path: ["monthDays"],
  });

export const receivableSchema = z.object({
  id,
  person: z.string().trim().min(1, "Who owes you?").max(60, "Keep it under 60 characters"),
  note: z.string().max(140),
  originalAmount: positiveMinor,
  startingCollected: minor.nonnegative(),
  dueDate: isoDate.optional(),
  closedAt: timestamp.optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const noteSchema = z.object({
  id,
  text: z.string().trim().min(1, "Write something first").max(2000, "Notes can be up to 2,000 characters"),
  pinned: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const shoppingItemSchema = z.object({
  id,
  label: z.string().trim().min(1, "What is it?").max(60, "Keep it under 60 characters"),
  price: minor.nonnegative(),
  quantity: z.number().int().min(1).max(999),
  inCart: z.boolean(),
  scanned: z.boolean().optional(),
  createdAt: timestamp,
});

export const tripSchema = z.object({
  id,
  name: z.string().trim().min(1, "Name this trip").max(60, "Keep it under 60 characters"),
  budget: minor.nonnegative(),
  categoryId: id,
  accountId: id.optional(),
  items: z.array(shoppingItemSchema).max(300, "That's a lot of items for one trip"),
  status: z.enum(["active", "done", "abandoned"]),
  startedAt: timestamp,
  closedAt: timestamp.optional(),
  transactionId: id.optional(),
  updatedAt: timestamp,
});

export const snapshotSchema = z.object({
  id: monthKey,
  generatedAt: timestamp,
  seen: z.boolean(),
  income: minor,
  spent: minor,
  saved: minor,
});

const mainGoalSchema = z.enum(["save", "control", "debt", "understand", "other"]);

export const settingsSchema = z.object({
  id: z.literal("app"),
  schemaVersion: z.number().int().positive(),
  onboarded: z.boolean(),
  // Optional so settings saved before the tour existed still validate.
  tourSeen: z.boolean().optional(),
  displayName: z.string().max(40),
  currency: currencySchema,
  locale: z.string().max(20),
  theme: z.enum(["light", "dark", "system", "timeOfDay"]),
  // Free strings, like the assistant provider: the palette and finish
  // catalogues can grow without invalidating settings already on a device.
  palette: z.string().min(1).max(32),
  heroStyle: z.string().min(1).max(32),
  heroPattern: z.enum(["rings", "feathers", "waves", "dots", "none"]),
  hideBalances: z.boolean(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  mainGoal: mainGoalSchema,
  mainGoals: z.array(mainGoalSchema).min(1).max(5),
  income: z.object({
    frequency: z.enum(["monthly", "semimonthly", "biweekly", "weekly", "irregular"]),
    paydays: z.array(z.number().int().min(1).max(31)).max(2),
    anchorDate: isoDate.optional(),
  }),
  safeToSpend: z.object({
    bufferMode: z.enum(["percent", "fixed"]),
    bufferPercent: z.number().min(0).max(50),
    bufferAmount: minor.nonnegative(),
    minimumBalance: minor.nonnegative(),
    monthlySavingsTarget: minor.nonnegative(),
    useGoalSuggestions: z.boolean(),
  }),
  security: z.object({
    pinEnabled: z.boolean(),
    pinHash: z.string().optional(),
    pinSalt: z.string().optional(),
    pinIterations: z.number().int().optional(),
    pinLength: z.number().int().min(4).max(6).optional(),
    autoLockMinutes: z.number().int().min(0).max(60),
    biometricEnabled: z.boolean(),
  }),
  assistant: z.object({
    // A free string, not an enum: the provider catalogue can grow without
    // invalidating settings already stored on someone's device.
    provider: z.string().min(1).max(32),
    model: z.string().min(1).max(96),
    baseUrl: z.string().max(200).optional(),
    brief: z.boolean(),
    shareNotes: z.boolean(),
    autoLog: z.boolean(),
  }),
  exchangeRates: z.partialRecord(z.enum(["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY"]), z.number().positive().max(1_000_000)),
  exchangeRatesUpdatedAt: timestamp.optional(),
  autoBackup: z.boolean(),
  dashboard: z.array(
    z.object({
      id: z.enum(["grove", "pending", "safeToSpend", "payday", "spending", "accounts", "thisMonth", "upcoming", "budgets", "goals", "recent"]),
      visible: z.boolean(),
    }),
  ),
  showNetWorth: z.boolean(),
  billReminders: z.boolean(),
  demoMode: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const datasetSchema = z.object({
  settings: settingsSchema,
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  bills: z.array(billSchema),
  goals: z.array(goalSchema),
  debts: z.array(debtSchema),
  recurring: z.array(recurringSchema),
  snapshots: z.array(snapshotSchema),
  // Added in schema v3; older backups simply have none.
  receivables: z.array(receivableSchema).default([]),
  notes: z.array(noteSchema).default([]),
  // Added in schema v4.
  trips: z.array(tripSchema).default([]),
});

/** Throws a readable error for the first validation issue. */
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ValidationError(issue?.message ?? "Invalid data", issue?.path.join(".") ?? "");
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
