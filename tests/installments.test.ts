import { describe, expect, it } from "vitest";
import type { DebtProgress } from "@/lib/finance/debts";
import { installmentPlan, installmentTotals, isInstallment, monthlyForPlan } from "@/lib/finance/installments";
import type { Debt } from "@/types/models";

const TODAY = "2026-09-28";

const debt = (over: Partial<Debt> = {}): Debt =>
  ({
    id: "d1",
    name: "Laptop",
    kind: "installment",
    startingBalance: 50_000_00,
    originalAmount: 50_000_00,
    minimumPayment: 4_166_00,
    termMonths: 12,
    startedOn: "2026-03-01",
    archived: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Debt;

const progress = (d: Debt, paid: number, remaining: number): DebtProgress => ({
  debt: d,
  remaining,
  paid,
  percent: 0,
  paidThisMonth: 0,
  monthsToPayoff: null,
  payoffDate: null,
  minimumMetThisMonth: true,
});

describe("isInstallment", () => {
  it("needs both the kind and a term", () => {
    expect(isInstallment(debt())).toBe(true);
    expect(isInstallment(debt({ termMonths: undefined }))).toBe(false);
    expect(isInstallment(debt({ kind: "personal_loan" }))).toBe(false);
  });
});

describe("monthlyForPlan", () => {
  it("divides the total across the term", () => {
    expect(monthlyForPlan(50_000_00, 12)).toBe(4_166_67);
    expect(monthlyForPlan(30_000_00, 6)).toBe(5_000_00);
    expect(monthlyForPlan(1_000_00, 0)).toBe(0);
  });
});

describe("installmentPlan", () => {
  it("counts payments made, not months elapsed", () => {
    const d = debt();
    const plan = installmentPlan(progress(d, 4_166_00 * 7, 4_166_00 * 5), TODAY);
    expect(plan).toMatchObject({ monthsPaid: 7, monthsLeft: 5, termMonths: 12, complete: false });
    expect(plan?.percent).toBeCloseTo(58.33, 1);
  });

  it("flags a plan that has fallen behind its schedule", () => {
    // Started March, so by late September seven payments are due.
    const plan = installmentPlan(progress(debt(), 4_166_00 * 5, 4_166_00 * 7), TODAY);
    expect(plan).toMatchObject({ monthsPaid: 5, behind: 2 });
  });

  it("is not behind when payments keep up", () => {
    expect(installmentPlan(progress(debt(), 4_166_00 * 7, 4_166_00 * 5), TODAY)?.behind).toBe(0);
  });

  it("knows when the plan is finished", () => {
    const plan = installmentPlan(progress(debt(), 50_000_00, 0), TODAY);
    expect(plan).toMatchObject({ complete: true, monthsLeft: 0, behind: 0, nextDue: null });
  });

  it("works out the last payment's month", () => {
    expect(installmentPlan(progress(debt(), 0, 50_000_00), TODAY)?.finalDue).toBe("2027-02-01");
  });

  it("falls back to the plan's own arithmetic when no monthly amount is set", () => {
    const plan = installmentPlan(progress(debt({ minimumPayment: 0 }), 0, 24_000_00), TODAY);
    expect(plan?.monthly).toBe(2_000_00);
  });

  it("returns nothing for debts that aren't plans", () => {
    expect(installmentPlan(progress(debt({ kind: "credit_card", termMonths: undefined }), 0, 100), TODAY)).toBeNull();
  });
});

describe("installmentTotals", () => {
  it("adds up only the plans still running", () => {
    const open = installmentPlan(progress(debt(), 4_166_00, 45_834_00), TODAY)!;
    const finished = installmentPlan(progress(debt({ id: "d2" }), 50_000_00, 0), TODAY)!;
    expect(installmentTotals([open, finished])).toEqual({ monthly: 4_166_00, remaining: 45_834_00, active: 1 });
  });
});
