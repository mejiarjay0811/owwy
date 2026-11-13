"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { today as getToday } from "@/lib/dates";
import { computeFinanceState, type FinanceState } from "@/lib/finance/state";
import { formatMoney, type FormatMoneyOptions } from "@/lib/money";
import { initializeApp } from "@/lib/services/app";
import { loadDataset } from "@/lib/storage/db";
import { withDefaults } from "@/lib/storage/repositories/settings";
import type { AppSettings, CurrencyCode, ISODate, Minor, OwwyDataset } from "@/types/models";

interface ReadyValue {
  status: "ready";
  data: OwwyDataset;
  /** Same dataset with transaction amounts in the main currency — use for totals, charts and analysis. */
  baseData: OwwyDataset;
  state: FinanceState;
  settings: AppSettings;
  today: ISODate;
  currency: CurrencyCode;
  /** Hide-balance mode is on. */
  hidden: boolean;
  /** Formats minor units in the user's currency. */
  fmt: (minor: Minor, options?: FormatMoneyOptions) => string;
}

type FinanceContextValue = ReadyValue | { status: "loading" } | { status: "error"; message: string };

const FinanceContext = createContext<FinanceContextValue>({ status: "loading" });

/**
 * One live subscription to the local database feeds every screen.
 * Any write — from any service — re-derives the whole financial picture,
 * so adding ₱500 of Food updates balances, budgets, Safe-to-Spend, insights
 * and history together.
 */
export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const today = useToday();
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const lastInitDay = useRef<string | null>(null);

  useEffect(() => {
    if (lastInitDay.current === today) return;
    lastInitDay.current = today;
    initializeApp(today)
      .then(() => setInitialized(true))
      .catch((error: unknown) => {
        console.error(error);
        setInitError(storageErrorMessage(error));
      });
  }, [today]);

  const raw = useLiveQuery(
    async () => {
      try {
        return { ok: true as const, data: await loadDataset() };
      } catch (error) {
        return { ok: false as const, message: storageErrorMessage(error) };
      }
    },
    [],
  );

  const value = useMemo<FinanceContextValue>(() => {
    if (initError) return { status: "error", message: initError };
    if (!raw || !initialized) return { status: "loading" };
    if (!raw.ok) return { status: "error", message: raw.message };
    const settings = withDefaults(raw.data.settings ?? {});
    const data: OwwyDataset = { ...raw.data, settings };
    const currency = settings.currency;
    const state = computeFinanceState(data, today);
    return {
      status: "ready",
      data,
      baseData: state.multiCurrency ? { ...data, transactions: state.baseTransactions } : data,
      state,
      settings,
      today,
      currency,
      hidden: settings.hideBalances,
      fmt: (minor, options) => formatMoney(minor, currency, { trimZeros: true, ...options }),
    };
  }, [raw, initialized, initError, today]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceStatus(): FinanceContextValue["status"] {
  return useContext(FinanceContext).status;
}

export function useFinanceError(): string | null {
  const value = useContext(FinanceContext);
  return value.status === "error" ? value.message : null;
}

/** Finance data for screens rendered inside the ready app shell. */
export function useFinance(): ReadyValue {
  const value = useContext(FinanceContext);
  if (value.status !== "ready") throw new Error("useFinance() used before Owwy finished loading.");
  return value;
}

export function useOptionalFinance(): ReadyValue | null {
  const value = useContext(FinanceContext);
  return value.status === "ready" ? value : null;
}

/** Current local date, refreshed at midnight and when the app returns to the foreground. */
export function useToday(): ISODate {
  const [value, setValue] = useState(() => getToday());

  const refresh = useCallback(() => {
    const next = getToday();
    setValue((current) => (current === next ? current : next));
  }, []);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime();
    const timer = window.setTimeout(refresh, midnight);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, value]);

  return value;
}

function storageErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "MissingAPIError" || name === "InvalidStateError") {
    return "Owwy couldn't open storage on this device. Private browsing modes sometimes block it — try a normal window or the installed app.";
  }
  if (name === "QuotaExceededError") {
    return "Your device is out of storage space. Free up some space so Owwy can keep saving your data.";
  }
  if (name === "VersionError") {
    return "This device has data from a newer version of Owwy. Please update the app.";
  }
  return "Owwy couldn't load your data. Your information is still on this device — try reopening the app.";
}
