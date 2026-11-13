import type { AppSettings, DashboardWidget } from "@/types/models";

export const SCHEMA_VERSION = 3;

export const DEFAULT_ASSISTANT_MODEL = "claude-opus-5";

export const ASSISTANT_MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5", hint: "Most thorough answers" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", hint: "Fast and capable" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "Quickest, lowest cost" },
] as const;

export const DEFAULT_DASHBOARD: DashboardWidget[] = [
  { id: "grove", visible: true },
  { id: "pending", visible: true },
  { id: "safeToSpend", visible: true },
  { id: "payday", visible: true },
  { id: "spending", visible: true },
  { id: "accounts", visible: true },
  { id: "thisMonth", visible: true },
  { id: "upcoming", visible: true },
  { id: "budgets", visible: true },
  { id: "goals", visible: true },
  { id: "recent", visible: true },
];

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidget["id"], { title: string; description: string }> = {
  grove: { title: "The Grove", description: "Your month as a growing forest, with quick entry" },
  pending: { title: "Waiting for you", description: "Automations that ask before logging" },
  safeToSpend: { title: "Safe to spend", description: "What you can spend until payday" },
  payday: { title: "Payday countdown", description: "Days until payday and what's coming in" },
  spending: { title: "Spending pulse", description: "Today, this week or this month, with a quick trend" },
  accounts: { title: "Your money", description: "Account cards and total balance" },
  thisMonth: { title: "This month", description: "Income, spending and savings" },
  upcoming: { title: "Upcoming", description: "Money coming in and going out soon" },
  budgets: { title: "Budgets", description: "Categories closest to their limit" },
  goals: { title: "Savings goals", description: "Progress toward your goals" },
  recent: { title: "Recent activity", description: "Your latest transactions" },
};

export function createDefaultSettings(now = Date.now()): AppSettings {
  return {
    id: "app",
    schemaVersion: SCHEMA_VERSION,
    onboarded: false,
    displayName: "",
    currency: "PHP",
    locale: "en-PH",
    // Light by default: the first run should look the same for everyone rather
  // than inheriting whatever the device happens to be set to. Dark, System and
  // the clock-following option are all one tap away in Settings.
  theme: "light",
    hideBalances: false,
    weekStartsOn: 1,
    mainGoal: "understand",
    income: { frequency: "semimonthly", paydays: [15, 31] },
    safeToSpend: {
      bufferMode: "percent",
      bufferPercent: 10,
      bufferAmount: 0,
      minimumBalance: 0,
      monthlySavingsTarget: 0,
      useGoalSuggestions: true,
    },
    security: {
      pinEnabled: false,
      autoLockMinutes: 1,
      biometricEnabled: false,
    },
    assistant: {
      provider: "local",
      model: DEFAULT_ASSISTANT_MODEL,
      brief: true,
      shareNotes: true,
      autoLog: false,
    },
    exchangeRates: {},
    autoBackup: true,
    dashboard: DEFAULT_DASHBOARD.map((w) => ({ ...w })),
    showNetWorth: true,
    billReminders: true,
    demoMode: false,
    createdAt: now,
    updatedAt: now,
  };
}
