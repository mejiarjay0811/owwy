"use client";

import { create } from "zustand";
import type { ID, ISODate, Minor, Transaction, TransactionType } from "@/types/models";

export interface TransactionPreset {
  type?: TransactionType;
  amount?: Minor;
  categoryId?: ID;
  accountId?: ID;
  toAccountId?: ID;
  date?: ISODate;
  note?: string;
  /** Sentence typed on the home composer; the sheet animates its parsed words into fields. */
  quickText?: string;
  /** Open straight into receipt scanning. */
  scan?: boolean;
}

export interface ToastItem {
  id: number;
  message: string;
  description?: string;
  tone: "default" | "success" | "error";
  action?: { label: string; onClick: () => void | Promise<void> };
  duration: number;
}

interface UIState {
  /** `session` changes on every open so the form remounts with a fresh draft. */
  transactionSheet: { open: boolean; session: number; editing?: Transaction; preset?: TransactionPreset };
  openAddTransaction: (preset?: TransactionPreset) => void;
  openEditTransaction: (transaction: Transaction) => void;
  closeTransactionSheet: () => void;

  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, "id" | "tone" | "duration"> & Partial<Pick<ToastItem, "tone" | "duration">>) => number;
  dismissToast: (id: number) => void;

  locked: boolean;
  setLocked: (locked: boolean) => void;

  /**
   * A replay asked for from More. The tour itself lives in the app shell, so
   * any screen can ask for it, and the shell is free to send you home first —
   * coach marks need the Grove and the hero to actually be on screen.
   */
  tourRequested: boolean;
  requestTour: () => void;
  clearTour: () => void;
}

let toastId = 0;

export const useUI = create<UIState>((set) => ({
  transactionSheet: { open: false, session: 0 },
  openAddTransaction: (preset) => set((s) => ({ transactionSheet: { open: true, session: s.transactionSheet.session + 1, preset } })),
  openEditTransaction: (editing) => set((s) => ({ transactionSheet: { open: true, session: s.transactionSheet.session + 1, editing } })),
  closeTransactionSheet: () => set((s) => ({ transactionSheet: { ...s.transactionSheet, open: false } })),

  toasts: [],
  pushToast: (toast) => {
    const id = ++toastId;
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { tone: "default", duration: toast.action ? 6000 : 3200, ...toast, id }],
    }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  locked: false,
  setLocked: (locked) => set({ locked }),

  tourRequested: false,
  requestTour: () => set({ tourRequested: true }),
  clearTour: () => set({ tourRequested: false }),
}));

/** Shorthand for components and services outside React render. */
export const toast = {
  show: (message: string, options: Partial<Omit<ToastItem, "id" | "message">> = {}) => useUI.getState().pushToast({ message, ...options }),
  success: (message: string, options: Partial<Omit<ToastItem, "id" | "message" | "tone">> = {}) =>
    useUI.getState().pushToast({ message, tone: "success", ...options }),
  error: (error: unknown, fallback = "Something went wrong. Nothing was changed.") =>
    useUI.getState().pushToast({ message: error instanceof Error && error.message ? error.message : fallback, tone: "error", duration: 5000 }),
};
