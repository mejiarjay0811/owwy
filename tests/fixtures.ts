import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";
import { createDefaultSettings } from "@/lib/defaults/settings";
import type { Account, Bill, Debt, OwwyDataset, RecurringTransaction, SavingsGoal, Transaction } from "@/types/models";

export const P = (major: number) => Math.round(major * 100);

let counter = 0;

export function account(overrides: Partial<Account> = {}): Account {
  counter++;
  return {
    id: `acc_${counter}`,
    name: `Account ${counter}`,
    type: "bank",
    openingBalance: 0,
    cardStyle: "evergreen",
    cardPattern: "none",
    includeInSafeToSpend: true,
    archived: false,
    order: counter,
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function tx(overrides: Partial<Transaction> & Pick<Transaction, "type" | "amount" | "accountId">): Transaction {
  counter++;
  return {
    id: `tx_${counter}`,
    date: "2026-09-10",
    note: "",
    tags: [],
    categoryId: overrides.type === "income" ? "cat_salary" : overrides.type === "expense" ? "cat_food" : undefined,
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function bill(overrides: Partial<Bill> = {}): Bill {
  counter++;
  return {
    id: `bill_${counter}`,
    name: "Electricity",
    emoji: "💡",
    amount: P(2100),
    categoryId: "cat_utilities",
    frequency: "monthly",
    nextDueDate: "2026-09-15",
    anchorDay: 15,
    remindDaysBefore: 2,
    active: true,
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function goal(overrides: Partial<SavingsGoal> & Pick<SavingsGoal, "accountId">): SavingsGoal {
  counter++;
  return {
    id: `goal_${counter}`,
    name: "New Phone",
    emoji: "📱",
    targetAmount: P(40000),
    startingAmount: 0,
    color: "#E8A33D",
    archived: false,
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function debt(overrides: Partial<Debt> = {}): Debt {
  counter++;
  return {
    id: `debt_${counter}`,
    name: "Loan",
    kind: "personal_loan",
    startingBalance: P(10000),
    originalAmount: P(10000),
    minimumPayment: P(1000),
    archived: false,
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function recurring(overrides: Partial<RecurringTransaction> & Pick<RecurringTransaction, "accountId">): RecurringTransaction {
  counter++;
  return {
    id: `rec_${counter}`,
    name: "Salary",
    type: "income",
    amount: P(30000),
    categoryId: "cat_salary",
    note: "",
    frequency: "monthly",
    startDate: "2026-09-01",
    nextDate: "2026-09-01",
    anchorDay: 1,
    mode: "auto",
    active: true,
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function dataset(overrides: Partial<OwwyDataset> = {}): OwwyDataset {
  return {
    settings: { ...createDefaultSettings(0), onboarded: true },
    accounts: [],
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    budgets: [],
    bills: [],
    goals: [],
    debts: [],
    recurring: [],
    snapshots: [],
    receivables: [],
    notes: [],
    trips: [],
    ...overrides,
  };
}
