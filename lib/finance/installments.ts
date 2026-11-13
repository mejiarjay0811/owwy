import { addMonths, diffDays, monthKey, monthStart } from "@/lib/dates";
import type { Debt, ISODate, Minor } from "@/types/models";
import type { DebtProgress } from "./debts";

export interface InstallmentPlan {
  /** What comes out each month. */
  monthly: Minor;
  termMonths: number;
  /** Payments actually made, counted from the money recorded against the plan. */
  monthsPaid: number;
  monthsLeft: number;
  remaining: Minor;
  /** 0–100 by months, which is how people think about installments. */
  percent: number;
  nextDue: ISODate | null;
  finalDue: ISODate | null;
  complete: boolean;
  /** Payments that should have been made by now but haven't. */
  behind: number;
}

/** A debt is an installment plan once it has a term to run for. */
export function isInstallment(debt: Debt): boolean {
  return debt.kind === "installment" && Boolean(debt.termMonths && debt.termMonths > 1);
}

/** The monthly amount a plan implies, for filling the field in as you type. */
export function monthlyForPlan(total: Minor, termMonths: number): Minor {
  if (termMonths <= 0) return 0;
  return Math.round(total / termMonths);
}

/**
 * Where an installment plan stands: months paid, months to go, and whether
 * it's behind. Counted from money actually recorded against the plan rather
 * than from the calendar, so a missed month shows up as being behind.
 */
export function installmentPlan(progress: DebtProgress, today: ISODate): InstallmentPlan | null {
  const { debt } = progress;
  if (!isInstallment(debt)) return null;

  const termMonths = debt.termMonths ?? 0;
  const monthly = debt.minimumPayment > 0 ? debt.minimumPayment : monthlyForPlan(progress.paid + progress.remaining, termMonths);
  const monthsPaid = monthly > 0 ? Math.min(termMonths, Math.floor(progress.paid / monthly)) : 0;
  const monthsLeft = Math.max(0, termMonths - monthsPaid);
  const complete = progress.remaining === 0 || monthsLeft === 0;

  // How many payments the schedule expects by now.
  let due = 0;
  if (debt.startedOn) {
    const elapsed = monthsBetween(debt.startedOn, today);
    due = Math.max(0, Math.min(termMonths, elapsed + 1));
  }

  return {
    monthly,
    termMonths,
    monthsPaid,
    monthsLeft,
    remaining: progress.remaining,
    percent: termMonths > 0 ? Math.min(100, (monthsPaid / termMonths) * 100) : 0,
    nextDue: complete ? null : (debt.nextDueDate ?? (debt.startedOn ? addMonths(debt.startedOn, monthsPaid) : null)),
    finalDue: debt.startedOn ? addMonths(debt.startedOn, termMonths - 1) : null,
    complete,
    behind: complete ? 0 : Math.max(0, due - monthsPaid),
  };
}

/** Whole months from one date to another, never negative. */
function monthsBetween(from: ISODate, to: ISODate): number {
  if (diffDays(from, to) < 0) return 0;
  const [fy, fm] = monthKey(from).split("-").map(Number);
  const [ty, tm] = monthKey(to).split("-").map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

/** Everything still to pay across every open plan, and the monthly bite. */
export function installmentTotals(plans: readonly InstallmentPlan[]): { monthly: Minor; remaining: Minor; active: number } {
  const open = plans.filter((plan) => !plan.complete);
  return {
    monthly: open.reduce((sum, plan) => sum + plan.monthly, 0),
    remaining: open.reduce((sum, plan) => sum + plan.remaining, 0),
    active: open.length,
  };
}

/** The month a plan finishes, for the "last payment" line. */
export function planEndsIn(plan: InstallmentPlan, today: ISODate): string | null {
  if (plan.complete) return null;
  const end = plan.finalDue ?? addMonths(monthStart(monthKey(today)), plan.monthsLeft - 1);
  return end;
}
